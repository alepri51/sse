class SSEPool {
    constructor({ pub, sub }) {
        if(pub && sub) {
            this.pub = pub;
            this.sub = sub;

            this.pool = {};
            this.sse_map = new WeakMap();
        }
        else {
            throw { code: 422, message: 'Missing params.' };
        }
    }

    connect(req, res, channels) {
        const { pub, sub } = this;
        const sse = new SSE({ pub, sub, pool: this });

        const start = sse.start(req, res, channels);

        return start;
    }

    disconnect(sse) {
    }

    publish({ channel, event, data }) {
        return this.pub.publish(`${process.env.NAMESPACE}:${channel}`, JSON.stringify({ event, data }));
    }
}

class SSE {
    constructor({ pub, sub, pool }) {
        if(pub && sub) {
            this.pub = pub;
            this.sub = sub;

            this.pool = pool;

            this.started = false;
        }
        else {
            throw { code: 422, message: 'Missing params.' };
        }
    }

    async start(req, res, channels) {
        if(!this.started) {
            this.stoped = false;

            if(req && res) {
                this.req = req;
                this.res = res;

                this.started = true;

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                    'Content-Encoding': 'no'
                });
            
                res.write('\n');
                res.write(`retry: 3000\n\n`);

                res.on('close', (...ags) => {
                    this.stoped = true;
                });

                res.on('end', (...ags) => {
                    this.stoped = true;
                });

                res.on('error', (...ags) => {
                    this.stoped = true;
                });
                
                res.on('aborted', (...ags) => {
                    this.stoped = true;
                });

                res.socket.on('close', function () {
                    this.stoped = true;
                });
            }

            channels = Array.isArray(channels) ? channels : [channels];

            for(const channel of channels) {
                const namespace_channel = `${process.env.NAMESPACE}:${channel}`;
    
                this.sub.subscribe(namespace_channel);
            }

            this.sub.on('message', (channel, message) => {
                const { event, data } = JSON.parse(message);

                event && this.res.write(`event: ${channel}:${event}\n`);
                this.res.write(`data: ${JSON.stringify(data) || ''}\n`);
                this.res.write(`id: ${Date.now()}\n\n`);
            });

            return new Promise(async (resolve, reject) => {
                while(!this.stoped) {
                    await new Promise((resolve) => {
                        setTimeout(() => {
                            this.res.write(`event: HEALTH\n`);
                            this.res.write(`data: ${Date.now()}\n`);
                            this.res.write(`id: ${Date.now()}\n\n`);
                            this.res.write(`retry: 10000\n\n`);
                            
                            resolve()
                        }, 15000);
                    })
                }

                reject({ code: 400, message: 'SSE client disconnected.' });
            });
        }
    }

    stop() {
        this.stoped = true;
    }
}

module.exports = SSEPool;