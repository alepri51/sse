const sseSubscribe = (req, res, onClose) => {
    //req.socket.setTimeout(0);
    //res.connection.setTimeout(0);
    req.on('close', () => {
        onClose && onClose(req);
    });

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'no'
    });

    res.write('\n');
    res.write(`retry: 3000\n\n`);

};

const ssePublish = (res, event, data) => {
    event && res.write(`event: ${event}\n`);
    res.write(`data: ${data || ''}\n\n`);
};


class SSE {
    constructor({ pub, sub } = {}) {
        this.error = void 0;
        this.ready = false;

        this.clients = {};

        const send = (channel, message, clients) => {
            let { event, data } = JSON.parse(message);
                    
            const publish = clients[channel];
            
            data = typeof(data) === 'object' ? JSON.stringify(data) : data;

            publish && publish.internal.forEach(internal => {
                internal(event, data)
            }); //publish.internal(event, data);
        }

        if(pub && sub) {
            this.sub = sub;
            this.pub = pub;

            this.sub.on('message', (channel, message) => {
                send(channel, message, this.clients);
            });
        }
        else {
            const self = this;

            this.pub = {
                publish(channel, message) {
                    send(channel, message, self.clients);
                }
            };

            this.sub = {
                subscribe(channel) {

                },
                unsubscribe(channel) {

                }
            };
        }
    }


    subscribe(req, res, channel) {
        const subscribe = (req, res) => {
            //const interval = setInterval(() => this.clients[channel] && this.clients[channel](void 0, channel), 10000);

            sseSubscribe(req, res, (req) => {
                //onClose
                if(this.clients[channel]) {
                    let external = this.clients[channel];
                    external.internal.delete(req);

                    if(!external.internal.size) {
                        this.clients[channel] = void 0;

                        //clearInterval(interval);

                        this.sub.unsubscribe(channel);

                        res.end();
                    }
                    
                }
            });

            return (event, data) => {
                ssePublish(res, event, data);
            }
        }

        let external = this.clients[channel];

        if(!external) {
            external = (event, data) => {
                this.pub.publish(channel, JSON.stringify({ event, data }));
            };
        }
        
        external.internal = external.internal || new Map();
        external.internal.set(req, subscribe(req, res));
        /* external.internal = external.internal || [];
        external.internal = [...external.internal, subscribe(req, res)]; */

        this.clients[channel] = external; //publish to client

        this.sub.subscribe(channel);

        return external;
    }
}

module.exports = (pub, sub) => new SSE(pub, sub);