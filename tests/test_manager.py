from datetime import timedelta


def test_init(stream_manager, controller, validator, token):
    assert stream_manager.MIN_STREAM_LIFE == timedelta(hours=1)
    assert stream_manager.controller == controller
    assert stream_manager.validators == [validator]
    assert stream_manager.is_accepted(token)


def test_add_rm_tokens(stream_manager, controller, create_token):
    new_token = create_token(controller)
    assert not stream_manager.is_accepted(new_token)

    stream_manager.add_token(new_token, sender=controller)
    assert stream_manager.is_accepted(new_token)

    stream_manager.remove_token(new_token, sender=controller)
    assert not stream_manager.is_accepted(new_token)
