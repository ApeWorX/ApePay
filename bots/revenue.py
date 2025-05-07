import os
from collections import defaultdict

from ape import convert
from ape_ethereum import multicall
from ape_tokens import tokens
from silverback import SilverbackBot

from apepay import StreamManager

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 100))

bot = SilverbackBot()
assert bot.signer, "Need a signer for this bot"

sm = StreamManager(os.environ["APEPAY_CONTRACT_ADDRESS"])

# NOTE: Must install `tokens`, then can use e.g. `"100 USDC"`
MIN_CLAIMS = {
    # NOTE: Defaults to "only claim when expired"
    token.symbol(): convert(os.environ.get(f"MIN_CLAIM_{token.symbol()}", 2**256 - 1), int)
    for token in tokens
}


@bot.on_startup()
async def load_streams(_ss):
    bot.state.unclaimed_streams = {stream.id: stream for stream in sm.unclaimed_streams()}


@sm.on_stream_created(bot)
async def add_stream(stream):
    bot.state.unclaimed_streams[stream.id] = stream


@sm.on_stream_claimed(bot)
async def check_if_finished(stream):
    if not stream.is_active:
        del bot.state.unclaimed_streams[stream.id]


@bot.cron(os.environ.get("CLAIM_SCHEDULE", "*/5 * * * *"))
async def current_revenue(time):
    unclaimed_streams = iter(bot.state.unclaimed_streams.values())
    total_revenue_collected: dict[str, float] = defaultdict(lambda: 0.0)

    more_streams = True
    while more_streams:
        tx = multicall.Transaction()

        while len(tx.calls) < BATCH_SIZE:
            try:
                stream = next(unclaimed_streams)
            except StopIteration:
                # So we break out of outer `while` loop (after calling `tx`)
                more_streams = False
                break  # Break out of inner `while` loop now

            if not stream.is_active:  # NOTE: Always claim inactive streams
                tx.add(sm.contract.claim_stream, stream.id)
                claim_amount = stream.info.funded_amount

            elif (claim_amount := stream.amount_claimable) > MIN_CLAIMS[stream.token.symbol()]:
                tx.add(sm.contract.claim_stream, stream.id)

            total_revenue_collected[stream.token.symbol()] += (
                claim_amount / 10 ** stream.token.decimals()
            )

        if len(tx.calls) > 0:
            tx(sender=bot.signer)

    return total_revenue_collected
