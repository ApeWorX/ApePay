import click
from ape.cli import ConnectedProviderCommand, account_option, network_option
from ape.types import AddressType
from ape_ethereum import multicall

from apepay import StreamManager


@click.group()
def cli():
    """
    Utlilities for viewing and claiming ApePay streams
    """


@cli.command(cls=ConnectedProviderCommand)
@network_option()
@click.option("--start-block", type=int)
@click.argument("address", type=AddressType)
def unclaimed(network, start_block, address):
    """List all unclaimed streams"""

    sm = StreamManager(address=address)
    for stream in sm.unclaimed_streams(start_block=start_block):
        click.echo(
            f"{stream.creator}/{stream.stream_id}: "
            f"{stream.amount_unlocked / 10 ** stream.token.decimals()} "
            f"{stream.token.symbol()}"
        )


@cli.command(cls=ConnectedProviderCommand)
@network_option()
@account_option()
@click.option("--start-block", type=int)
@click.option("--batch-size", type=int, default=256)
@click.argument("address", type=AddressType)
def claim(network, account, start_block, batch_size, address):
    """Claim unclaimed streams using multicall (anyone can claim)"""

    sm = StreamManager(address=address)
    unclaimed_streams = sm.unclaimed_streams(start_block=start_block)
    more_streams = True

    while more_streams:
        tx = multicall.Transaction()

        for _ in range(batch_size):
            try:
                stream = next(unclaimed_streams)
            except StopIteration:
                more_streams = False
                break

            tx.add(sm.contract.claim, stream.creator, stream.stream_id)

        tx(sender=account)
