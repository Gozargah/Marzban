from threading import Thread


def threaded_function(func):
    def wrapper(*args, **kwargs):
        thread = Thread(target=func, args=args, daemon=True, kwargs=kwargs)
        thread.start()
    return wrapper
