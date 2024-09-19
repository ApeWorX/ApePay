# pragma version 0.4.0

"""
@title StreamFactory
@author ApeWorX LTD.
@dev  The StreamFactory is a simple CREATE2 Factory for a given on-chain StreamManager
    ERC5202 blueprint deployment. Any call to `create` will create a new StreamManager
    deployment using the immutable initcode stored at `BLUEPRINT`. Only one deployment
    per account is allowed to be created, using the deployer's address for the CREATE2
    `salt`. Once the deployment is created, it is registered in the `deployments` view
    function for external reference.
"""
ONE_HOUR: constant(uint256) = 60 * 60
BLUEPRINT: public(immutable(address))

deployments: public(HashMap[address, address])


event ManagerCreated:
    owner: indexed(address)
    manager: address
    accepted_tokens: DynArray[address, 20]
    validators: DynArray[address, 10]


@deploy
def __init__(blueprint: address):
    BLUEPRINT = blueprint


@external
def create(
    accepted_tokens: DynArray[address, 20] = [],
    validators: DynArray[address, 10] = [],
    min_stream_time: uint256 = ONE_HOUR,
) -> address:
    deployment: address = create_from_blueprint(  # dev: only one deployment allowed
        BLUEPRINT,
        msg.sender,  # Only caller can create
        min_stream_time,  # Safety parameter for new streams
        validators,
        accepted_tokens,  # whatever caller wants to accept
        salt=convert(msg.sender, bytes32),  # Ensures unique deployment per caller
        code_offset=3,
    )
    self.deployments[msg.sender] = deployment

    log ManagerCreated(msg.sender, deployment, accepted_tokens, validators)

    return deployment
