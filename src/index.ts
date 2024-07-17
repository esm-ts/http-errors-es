/*!
 * http-errors
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2016 Douglas Christopher Wilson
 * Copyright(c) 2024 Evgenii Troinov
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

import statuses from 'statuses-es'
import depd from 'depd'

import setPrototypeOf from 'setprototypeof'
import inherits from 'inherits'
import toIdentifier from 'toidentifier'

const deprecate = depd('http-errors')

export interface HttpError<N extends number = number> extends Error {
  status: N
  statusCode: N
  expose: boolean
  headers?: {
    [key: string]: string
  } | undefined
  [key: string]: any
}

/**
 * Get the code class of a status code.
 */

function codeClass (status: number): number {
  return Number(String(status).charAt(0) + '00')
}

/**
 * Create HTTP error abstract base class.
 */

function createHttpErrorConstructor (): Function {
  function HttpError (): void {
    throw new TypeError('cannot construct abstract class')
  }

  inherits(HttpError, Error)

  return HttpError
}

/**
 * Create a constructor for a client error.
 */

function createClientErrorConstructor (HttpError: Function, name: string, code: number): Function {
  const className = toClassName(name)

  function ClientError (message: string): Error {
    // create the error object
    // @ts-expect-error
    const msg = message != null ? message : statuses.message[code]
    const err = new Error(msg)

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ClientError)

    // adjust the [[Prototype]]
    setPrototypeOf(err, ClientError.prototype)

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    })

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    })

    return err
  }

  inherits(ClientError, HttpError)
  nameFunc(ClientError, className)

  ClientError.prototype.status = code
  ClientError.prototype.statusCode = code
  ClientError.prototype.expose = true

  return ClientError
}

/**
 * Create function to test is a value is a HttpError.
 */

function createIsHttpErrorFunction (HttpError: any) {
  return function isHttpError (val: any) {
    if (val === null || val === undefined || typeof val !== 'object') {
      return false
    }

    if (val instanceof HttpError) {
      return true
    }

    return val instanceof Error &&
      // @ts-expect-error
      typeof val.expose === 'boolean' &&
      // @ts-expect-error
      typeof val.statusCode === 'number' && val.status === val.statusCode
  }
}

/**
 * Create a constructor for a server error.
 */

function createServerErrorConstructor (HttpError: any, name: string, code: number): Function {
  const className = toClassName(name)

  function ServerError (message: string): Error {
    // create the error object
    // @ts-expect-error
    const msg = message != null ? message : statuses.message[code]
    const err = new Error(msg)

    // capture a stack trace to the construction point
    Error.captureStackTrace(err, ServerError)

    // adjust the [[Prototype]]
    setPrototypeOf(err, ServerError.prototype)

    // redefine the error message
    Object.defineProperty(err, 'message', {
      enumerable: true,
      configurable: true,
      value: msg,
      writable: true
    })

    // redefine the error name
    Object.defineProperty(err, 'name', {
      enumerable: false,
      configurable: true,
      value: className,
      writable: true
    })

    return err
  }

  inherits(ServerError, HttpError)
  nameFunc(ServerError, className)

  ServerError.prototype.status = code
  ServerError.prototype.statusCode = code
  ServerError.prototype.expose = false

  return ServerError
}

/**
 * Set the name of a function, if possible.
 * @private
 */

function nameFunc (func: Function, name: string): void {
  const desc = Object.getOwnPropertyDescriptor(func, 'name')

  if (desc !== null && desc !== undefined && Boolean(desc.configurable)) {
    desc.value = name
    Object.defineProperty(func, 'name', desc)
  }
}

/**
 * Populate the exports object with constructors for every error class.
 * @private
 */

function populateConstructorExports (exports: any, codes: number[], HttpError: Function): void {
  codes.forEach(function forEachCode (code) {
    let CodeError
    // @ts-expect-error
    const name = toIdentifier(statuses.message[code])

    switch (codeClass(code)) {
      case 400:
        CodeError = createClientErrorConstructor(HttpError, name, code)
        break
      case 500:
        CodeError = createServerErrorConstructor(HttpError, name, code)
        break
    }

    if (CodeError != null) {
      // export the constructor
      exports[code] = CodeError
      exports[name] = CodeError
    }
  })
}

/**
 * Get a class name from a name identifier.
 * @private
 */

function toClassName (name: string): string {
  return name.slice(-5) !== 'Error'
    ? `${name}Error`
    : name
}

/**
 * Create a new HTTP Error.
 *
 * @returns {Error}
 * @public
 */

function createError (...args: any[]): any {
  // so much arity going on ~_~
  let err: {
    status?: number
    statusCode?: number
    expose?: boolean
  } & Error
  let msg: string | undefined
  let status: number = 500
  let props: any = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const type = typeof arg

    if (type === 'object' && arg instanceof Error) {
      err = arg
      status = err.status ?? err.statusCode ?? status
    } else if (type === 'number' && i === 0) {
      status = arg
    } else if (type === 'string') {
      msg = arg
    } else if (type === 'object') {
      props = arg
    } else {
      throw new TypeError(`argument #${i + 1} unsupported type ${type}`)
    }
  }

  if (typeof status === 'number' && (status < 400 || status >= 600)) {
    deprecate('non-error status code; use only 4xx or 5xx status codes')
  }

  if (typeof status !== 'number' ||
    (!(String(status) in statuses.message) && (status < 400 || status >= 600))) {
    status = 500
  }

  // constructor
  // @ts-expect-error
  const HttpError = createError[status] || createError[codeClass(status)]

  // @ts-expect-error
  if (err === undefined || err === null) {
    // create error
    err = HttpError !== null && HttpError !== undefined
      ? new HttpError(msg)
      : new Error(msg ?? (statuses.message as any)[String(status)])
    Error.captureStackTrace(err, createError)
  }

  if (!HttpError || !(err instanceof HttpError) || err?.status !== status) {
    // add properties to generic error
    err.expose = status < 500
    err.status = err.statusCode = status
  }

  for (const key in props) {
    if (key !== 'status' && key !== 'statusCode') {
      // @ts-expect-error
      err[key] = props[key]
    }
  }

  return err
}

/**
 * Module exports.
 * @public
 */

createError.HttpError = createHttpErrorConstructor()
createError.isHttpError = createIsHttpErrorFunction(module.exports.HttpError)

// Populate exports for all constructors
populateConstructorExports(createError, statuses.codes, createError.HttpError)

export default createError
