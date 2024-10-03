import click
from ape.cli import ConnectedProviderCommand, account_option, network_option
from ape_ethereum import multicall

from apepay import StreamManager


@click.group()
def cli():
    """
    Utlilities for viewing and claiming ApePay streams
    """


@cli.command(cls=ConnectedProviderCommand)
@network_option()
@click.argument("manager", type=StreamManager)
def unclaimed(manager):
    """List all unclaimed streams"""

    for stream in manager.unclaimed_streams():
        stream_balance = stream.amount_claimable / 10 ** stream.token.decimals()
        click.echo(f"{stream.id}: {stream_balance} {stream.token.symbol()}")


@cli.command(cls=ConnectedProviderCommand)
@network_option()
@account_option()
@click.option("--batch-size", type=int, default=256)
@click.option("--multicall/--no-multicall", "use_multicall", default=True)
@click.argument("manager", type=StreamManager)
def claim(account, batch_size, use_multicall, manager):
    """Claim unclaimed streams using multicall (anyone can claim)"""

    unclaimed_streams = manager.unclaimed_streams()

    if not use_multicall:
        for _ in range(batch_size):
            try:
                stream = next(unclaimed_streams)
            except StopIteration:
                click.secho("SUCCESS: All Streams Claimed!", fg="green")
                return

            stream.claim(sender=account)

        click.echo(f"INFO: {len(list(unclaimed_streams))} more claims needed...")
        return

    # else: use multicall
    more_streams = True

    while more_streams:
        tx = multicall.Transaction()

        for _ in range(batch_size):
            try:
                stream = next(unclaimed_streams)
            except StopIteration:
                more_streams = False
                break

            tx.add(manager.contract.claim_stream, stream.id)

        try:
            tx(sender=account)
        except multicall.exceptions.UnsupportedChainError as e:
            raise click.UsageError("Multicall not supported, try with `--no-multicall`") from e
