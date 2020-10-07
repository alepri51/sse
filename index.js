const { Readable } = require('stream');

const sse = (req, res, stream) => {
    req.socket.setTimeout(Number.MAX_VALUE);

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

const publish = (stream, event, data) => {
    event && stream.push(`event: ${event}\n`);
    stream.push(`data: ${data || ''}\n\n`);
};


class SSE extends Readable {
    constructor({ pub, sub } = {}) {
        super();

        this.error = void 0;
        this.ready = false;
        this.channel = void 0;

        if(pub && sub) {
            this.sub = sub;
            this.pub = pub;

            this.sub.on('message', (channel, message) => {
                let { event, data } = JSON.parse(message);

                publish(this, event, data);
            });
        }
        else {
            const self = this;

            this.pub = {
                publish(channel, message) {
                    let { event, data } = JSON.parse(message);

                    publish(self, event, data);
                }
            };

            this.sub = {
                subscribe(channel) {

                }
            };
        }
    }

    _read() {

    }

    subscribe(req, res, channel) {
        this.channel = channel;
        this.sub.subscribe(channel);

        sse(req, res, this);

        setInterval(() => this.publish(void 0, void 0), 10000);
    }

    publish(event, data) {
        this.channel && this.pub.publish(this.channel, JSON.stringify({ event, data }));
    }
}

module.exports = (pub, sub) => new SSE(pub, sub);