import click
from ape import Contract, project
from ape.cli import ConnectedProviderCommand, account_option, ape_cli_context
from ape.exceptions import ApeException
from ape_ethereum.ecosystem import keccak

try:
    from ape_tokens import tokens as token_lookup
except ImportError:
    token_lookup = {}


@click.group()
def cli():
    """
    Deploy contract from project
    """


@cli.command(cls=ConnectedProviderCommand, short_help="Deploy the StreamFactory contract")
@account_option()
@ape_cli_context()
@click.option("--blueprint", default=None)
@click.option("--create2", default=None, help="A string tag for the create2 deployment salt")
@click.option("--publish", is_flag=True)
def factory(cli_ctx, account, ecosystem, network, blueprint, create2, publish):
    if create2:
        # NOTE: This is the deployment address listed on the create2 deployer's github:
        # https://github.com/pcaversaccio/create2deployer/tree/main#deployments-create2deployer
        # TODO: Add SDK for create2 deployer
        create2_deployer = Contract("0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2")
        salt = keccak(text=create2)

        if not blueprint:
            blueprint_initcode = ecosystem.encode_contract_blueprint(
                project.StreamManager.contract_type
            ).data
            blueprint = create2_deployer.computeAddress(salt, keccak(blueprint_initcode))
            if not click.confirm(f"Deploy StreamManager blueprint to '{blueprint}'"):
                return  # user abort

            create2_deployer.deploy(
                0,  # msg.value
                salt,
                blueprint_initcode,
                sender=account,
            )
            cli_ctx.logger.success(
                f"Blueprint 'StreamManager' deployed to: {click.style(blueprint, bold=True)}"
            )
            cli_ctx.chain_manager.contracts.cache_blueprint(
                blueprint, project.StreamManager.contract_type
            )

        factory_initcode = project.StreamFactory.constructor.serialize_transaction(blueprint).data
        factory_address = create2_deployer.computeAddress(salt, keccak(factory_initcode))

        if click.confirm(f"Deploy StreamFactory to '{factory_address}'"):
            create2_deployer.deploy(
                0,  # msg.value
                salt,
                factory_initcode,
                sender=account,
            )
            factory = project.StreamFactory.at(factory_address)

            if publish:
                cli_ctx.local_project.track_deployment(factory)
                network.publish_contract(factory.address)

    else:
        if not blueprint:
            blueprint = project.StreamFactory.declare(sender=account).contract_address
            cli_ctx.logger.success(
                f"Blueprint 'StreamManager' deployed to: {click.style(blueprint, bold=True)}"
            )

        account.deploy(project.StreamFactory, blueprint, publish=publish)


@cli.command(cls=ConnectedProviderCommand, short_help="Deploy the StreamManager contract")
@ape_cli_context()
@account_option()
@click.option("--factory", default=None)
@click.option("--owner", default=None)
@click.option("--min-stream-life", type=int, default=60 * 60)
@click.option("--validator", "validators", multiple=True, default=[])
@click.option("--publish", is_flag=True)
@click.argument("tokens", nargs=-1)
def manager(
    cli_ctx, account, network, factory, owner, min_stream_life, validators, publish, tokens
):
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

    if factory := factory and project.StreamFactory.at(factory):
        if owner:
            raise click.BadArgumentUsage("Cannot use 'owner' with 'factory'")

        if min_stream_life != 60 * 60:
            raise click.BadArgumentUsage("Cannot use custom 'min_stream_life'")

        tx = factory.create(list(validators), token_addresses, sender=account)
        try:
            manager = project.StreamManager.at(tx.return_value)
        except ApeException:
            manager = project.StreamManager.at(factory.deployments(account))

        cli_ctx.logger.success(f"StreamManager deployed to '{manager.address}'.")

        if publish:
            cli_ctx.local_project.track_deployment(manager)
            network.publish_contract(manager.address)

    else:
        account.deploy(
            project.StreamManager,
            owner or account,
            min_stream_life,
            token_addresses,
            list(validators),
            publish=publish,
        )


@cli.command(cls=ConnectedProviderCommand, short_help="Deploy a Mock token")
@ape_cli_context()
@account_option()
def token(cli_ctx, account):
    account.deploy(project.TestToken)
