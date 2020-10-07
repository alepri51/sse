const sseSubscribe = (req, res, onClose) => {
    req.socket.setTimeout(0);

    req.connection.on('close', () => {
        onClose && onClose();
    });

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'no'
    });

    //res.write('\n');
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
            
            publish && publish(event, data);
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
            const interval = setInterval(() => this.clients[channel](void 0, channel), 10000);

            sseSubscribe(req, res, () => {
                //onClose
                clearInterval(interval);

                this.sub.unsubscribe(channel);

                this.clients[channel] = void 0;

                res.end();
            });

            return (event, data) => {
                ssePublish(res, event, data);
            }
        }

        this.clients[channel] = subscribe(req, res); //publish to client

        this.sub.subscribe(channel);

        

        return (event, data) => {
            this.pub.publish(channel, JSON.stringify({ event, data }));
        };
    }
}

module.exports = (pub, sub) => new SSE(pub, sub);