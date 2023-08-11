import click
from ape import networks, project
from ape.cli import NetworkBoundCommand, account_option, ape_cli_context, network_option
from ape.types import HexBytes

try:
    from ape_tokens import tokens as token_lookup
except ImportError:
    token_lookup = {}


@click.group()
def cli():
    """
    Deploy contract from project
    """


@cli.command(cls=NetworkBoundCommand, short_help="Deploy the StreamFactory contract")
@account_option()
@network_option()
@ape_cli_context()
@click.option("--blueprint", default=None)
def factory(cli_ctx, account, network, blueprint):
    if not blueprint:
        blueprint = project.StreamFactory.declare(sender=account).contract_address
        cli_ctx.logger.success(
            f"Blueprint 'StreamManager' deployed to: {click.style(blueprint, bold=True)}"
        )

    account.deploy(project.StreamFactory, blueprint, publish=click.confirm("Publish"))


@cli.command(cls=NetworkBoundCommand, short_help="Deploy the StreamManager contract")
@account_option()
@network_option()
@click.option("--owner", default=None)
@click.option("--min-stream-life", type=int, default=60 * 60)
@click.option("--validator", "validators", multiple=True, default=[])
@click.argument("tokens", nargs=-1)
def manager(account, network, owner, min_stream_life, validators, tokens):
    if len(tokens) > 20:
        raise click.BadArgumentUsage("Doesn't accept more than 20 tokens")

    if len(set(tokens)) < len(tokens):
        raise click.BadArgumentUsage("Duplicate in accepted tokens")

    token_addresses = []
    for token in tokens:
        try:
            token_addresses.append(token_lookup[token])  # allow specifying by address
        except KeyError:
            token_addresses.append(token)

    account.deploy(
        project.StreamManager,
        owner or account,
        min_stream_life,
        list(validators),
        token_addresses,
        publish=click.confirm("Publish"),
    )
