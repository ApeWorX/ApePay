"""
A simple example showing how to use ApePay in a script.
"""

from datetime import timedelta

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

    # Make sure your payer has 10k tokens.
    balance = token.balanceOf(payer)
    desired_balance = 10_000 * 10 ** token.decimals()
    if balance < desired_balance:
        difference = desired_balance - balance
        token.DEBUG_mint(payer, difference, sender=payer)

    # Approve the amount it costs for the deployment.
    # In this demo, we know it will add up to 26 tokens.
    token.approve(sm.contract, 2 ** 256 - 1, sender=payer)
    decimals = token.decimals()

    # 26 tokens per day
    seconds = timedelta(days=1).total_seconds()
    tokens = 26 * 10 ** decimals

    # Create the stream.
    stream = sm.create(
        token,
        int(tokens / seconds),
        reason="1",  # The ID of the deployment as a string
        sender=payer,
    )

    click.echo(f"Stream '{stream.stream_id}' created successfully by '{stream.creator}'.")
