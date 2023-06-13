export const tryParseJSON = (message: any) => {
    if (typeof message === "string") {
      try {
        message = JSON.parse(message)
      } catch (e) {}
    }
    return message
  }