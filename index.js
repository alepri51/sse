const { Readable } = require('stream');

const sseSubscribe = (req, res, stream) => {
    req.socket.setTimeout(0);

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'no'
    });

    stream.pipe(res);

    stream.push('\n');
    stream.push(`retry: 3000\n\n`);
};

const ssePublish = (stream, event, data) => {
    event && stream.push(`event: ${event}\n`);
    stream.push(`data: ${data || ''}\n\n`);
};


class SSE {
    constructor({ pub, sub } = {}) {
        this.error = void 0;
        this.ready = false;

        this.clients = {};

        if(pub && sub) {
            this.sub = sub;
            this.pub = pub;

            this.sub.on('message', (channel, message) => {
                let { event, data } = JSON.parse(message);
                    
                const publish = this.clients[channel]
                
                publish && publish(event, data);
            });
        }
        else {
            const self = this;

            this.pub = {
                publish(channel, message) {
                    let { event, data } = JSON.parse(message);
                    
                    const publish = self.clients[channel];
                    
                    publish && publish(event, data);
                }
            };

            this.sub = {
                subscribe(channel) {

                }
            };
        }
    }

    /* _read() {

    } */

    subscribe(req, res, channel) {
        const stream = new Readable();
        stream._read = () => {};
        
        const subscribe = (req, res, stream) => {
            sseSubscribe(req, res, stream);

            return (event, data) => {
                ssePublish(stream, event, data);
            }
        }

        this.clients[channel] = subscribe(req, res, stream); //publish to client

        this.sub.subscribe(channel);

        //setInterval(() => this.clients[channel](void 0, void 0), 10000);

        return (event, data) => {
            this.pub.publish(channel, JSON.stringify({ event, data }));
        };
    }

    /* publish(event, data) {
        this.channel && this.pub.publish(this.channel, JSON.stringify({ event, data }));
    } */
}

module.exports = (pub, sub) => new SSE(pub, sub);