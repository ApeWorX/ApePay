import os

from silverback import SilverbackApp

from apepay import Stream, StreamManager

app = SilverbackApp()
# NOTE: This bot assumes you use a new bot per ApePay deployment
sm = StreamManager(os.environ["APEPAY_CONTRACT_ADDRESS"])

# NOTE: You would probably want to index your db by network and deployment address,
#       if you were operating on multiple networks and/or deployments (for easy lookup)
db: dict[int, Stream] = dict()
# TODO: Migrate to `app.state.db` when feature becomes available


@app.on_startup()
async def load_db(_):
    for stream in sm.active_streams():
        db[stream.id] = stream


@sm.on_stream_created(app)
async def grant_product(stream):
    db[stream.id] = stream
    print(f"provisioning products: {stream.products}")
    return stream.time_left


@sm.on_stream_funded(app)
async def update_product_funding(stream):
    # NOTE: properties of stream have changed, you may not need to handle this, but typically you
    #       would want to update `stream.time_left` in db for use in user Stream life notifications
    db[stream.id] = stream
    return stream.time_left


@sm.on_stream_cancelled(app)
async def revoke_product(stream):
    print(f"unprovisioning product for {stream.creator}")
    db[stream.id] = None
    return stream.time_left
