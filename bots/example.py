import os

from silverback import SilverbackBot

from apepay import Stream, StreamManager

bot = SilverbackBot()
# NOTE: This bot assumes you use a new bot per ApePay deployment
sm = StreamManager(os.environ["APEPAY_CONTRACT_ADDRESS"])

# NOTE: You would probably want to index your db by network and deployment address,
#       if you were operating on multiple networks and/or deployments (for easy lookup)
db: dict[int, Stream] = dict()
# TODO: Migrate to `app.state.db` when feature becomes available


@bot.on_startup()
async def load_db(_):
    for stream in sm.active_streams():
        db[stream.id] = stream


@sm.on_stream_created(bot)
async def grant_product(stream):
    db[stream.id] = stream
    print(f"provisioning products: {stream.products}")  # noqa: T001
    return stream.time_left


@sm.on_stream_funded(bot)
async def update_product_funding(stream):
    # NOTE: properties of stream have changed, you may not need to handle this, but typically you
    #       would want to update `stream.time_left` in db for use in user Stream life notifications
    db[stream.id] = stream
    return stream.time_left


@sm.on_stream_cancelled(bot)
async def revoke_product(stream):
    print(f"unprovisioning product for {stream.creator}")  # noqa: T001
    db[stream.id] = None
    return stream.time_left
