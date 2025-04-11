# pragma version 0.4.0
# TODO: Replace w/ Snekmate
totalSupply: public(uint256)
balanceOf: public(HashMap[address, uint256])
allowance: public(HashMap[address, HashMap[address, uint256]])

name: public(constant(String[10])) = "Test Token"
symbol: public(constant(String[4])) = "TEST"
decimals: public(constant(uint8)) = 18

@deploy
def __init__():
    self.totalSupply = 100 * 10 ** convert(decimals, uint256)
    self.balanceOf[msg.sender] = 100 * 10 ** convert(decimals, uint256)


@external
def transfer(receiver: address, amount: uint256) -> bool:
    self.balanceOf[msg.sender] -= amount  # dev: not enough balance
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
    self.allowance[sender][msg.sender] -= amount  # dev: not enough allowance
    self.balanceOf[sender] -= amount  # dev: not enough balance
    self.balanceOf[receiver] += amount
    # NOTE: No event
    return True


@external
def DEBUG_mint(receiver: address, amount: uint256):
    self.balanceOf[receiver] += amount
