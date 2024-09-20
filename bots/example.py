import os
from datetime import timedelta

from ape_ethereum import multicall
from silverback import SilverbackApp

from apepay import StreamManager

app = SilverbackApp()
# NOTE: You should use one bot per-supported network
# NOTE: This bot assumes you use a new bot per deployment
sm = StreamManager(os.environ["APEPAY_CONTRACT_ADDRESS"])

# NOTE: You would probably want to index this by network and deployment,
#       if you were operating on multiple networks or deployments
db = []
# TODO: Migrate to `app.state.db` when feature becomes available


@app.on_startup()
async def load_db(_):
    for stream in sm.active_streams():
        db.append(stream)


@sm.on_stream_created(app)
async def grant_product(stream):
    db.append(stream)
    print(f"provisioning product for {stream.creator}")
    return stream.time_left


@sm.on_stream_funded(app)
async def update_product_funding(stream):
    # NOTE: properties of stream have changed, you may not need to handle this
    #       but typically you would want to update `stream.time_left` in record
    db.remove(
        next(s for s in db if s.stream_id == stream.stream_id and s.creator == stream.creator)
    )
    db.append(stream)
    return stream.time_left


@sm.on_stream_cancelled(app)
async def revoke_product(stream):
    print(f"unprovisioning product for {stream.creator}")
    db.remove(stream)
