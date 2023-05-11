# TODO: Replace w/ Snekmate
totalSupply: public(uint256)
balanceOf: public(HashMap[address, uint256])
allowance: public(HashMap[address, HashMap[address, uint256]])


@external
def __init__():
    self.totalSupply = 100 * 10 ** 18
    self.balanceOf[msg.sender] = 100 * 10 ** 18


@external
def transfer(receiver: address, amount: uint256) -> bool:
    self.balanceOf[msg.sender] -= amount
    self.balanceOf[receiver] += amount
    # NOTE: No event
    return True


@external
def approve(spender: address, amount: uint256) -> bool:
    self.allowance[msg.sender][spender] = amount
    # NOTE: No event
    return True


@external
def transferFrom(sender: address, receiver: address, amount: uint256) -> bool:
    self.allowance[sender][msg.sender] -= amount
    self.balanceOf[sender] -= amount
    self.balanceOf[receiver] += amount
    # NOTE: No event
    return True


@external
def DEBUG_mint(receiver: address, amount: uint256):
    self.balanceOf[receiver] += amount
