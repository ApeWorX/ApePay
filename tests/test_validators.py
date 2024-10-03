import pytest


@pytest.mark.parametrize("num_validators", [1, 2, 3])
def test_set_validators(stream_manager, controller, create_validator, num_validators):
    new_validators = [create_validator() for _ in range(num_validators)]
    assert all(v not in stream_manager.validators for v in new_validators)
    assert len(stream_manager.validators) == 1

    stream_manager.add_validators(*new_validators, sender=controller)
    assert all(v in stream_manager.validators for v in new_validators)
    assert len(stream_manager.validators) == num_validators + 1

    stream_manager.remove_validators(*new_validators, sender=controller)
    assert all(v not in stream_manager.validators for v in new_validators)
    assert len(stream_manager.validators) == 1

    stream_manager.set_validators(*new_validators, sender=controller)
    assert all(v in stream_manager.validators for v in new_validators)
    assert len(stream_manager.validators) == num_validators

    obselete = new_validators[0]
    replacement = create_validator()
    stream_manager.replace_validator(obselete, replacement, sender=controller)
    assert obselete not in stream_manager.validators
    assert replacement in stream_manager.validators
    assert len(stream_manager.validators) == len(new_validators)
