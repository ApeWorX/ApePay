"""
A simple example showing how to use ApePay in a script.
"""

import click
from ape.cli import NetworkBoundCommand, ape_cli_context, network_option

from apepay import StreamManager


@click.command(cls=NetworkBoundCommand)
@network_option()
@ape_cli_context()
@click.option(
    "--apepay",
    "sm",
    default="0xb5ed1ef2a90527b402cd7e7d415027cb94e1db4e",
    callback=lambda c, p, v: StreamManager(address=v),
)
@click.option("--token", default="0xbc083d97825da7f7182f37fcec51818e196af1ff")
@click.option("--ecosystem-name", default="devnet")
def cli(cli_ctx, network, sm, token, ecosystem_name):
    network = cli_ctx.provider.network.name
    if network != "sepolia-fork":
        cli_ctx.abort("Currently, this script only works on sepolia-fork.")

    payer = cli_ctx.account_manager.test_accounts[0]

    # Make sure account can pay.
    token = cli_ctx.chain_manager.contracts.instance_at(token)

    balance = token.balanceOf(payer)
    desired_balance = 1_000_000
    if balance < desired_balance:
        difference = desired_balance - balance
        token.DEBUG_mint(payer, difference, sender=payer)

    # Approve **entire balance** on apepay.
    token.approve(sm.contract, 2**256 - 1, sender=payer)

    # Use an application-specific reason.
    reason = {
        "ecosystem_name": ecosystem_name,
        "block_height": 17743333,
        "block_time": 15,
        "bot_names": [],
    }
    minimum = int(sm.MIN_STREAM_LIFE.total_seconds())
    amt_per_sec = token.balanceOf(payer) // minimum

    # Create the stream.
    stream = sm.create(token, amt_per_sec, reason=reason, sender=payer)

    click.echo(stream)
