const EventEmitter = require('events').EventEmitter;
const JsSIP_C = require('../Constants');
const Exceptions = require('../Exceptions');
const Utils = require('../Utils');

module.exports = class Message extends EventEmitter
{
  constructor(session)
  {
    super();

    this._session = session;
    this._direction = null;
    this._contentType = null;
    this._body = null;
  }

  get contentType()
  {
    return this._contentType;
  }

  get body()
  {
    return this._body;
  }

  send(contentType, body, options = {})
  {
    this._direction = 'outgoing';

    if (contentType === undefined)
    {
      throw new TypeError('Not enough arguments');
    }

    // Check RTCSession Status.
    if (this._session.status !== this._session.C.STATUS_ANSWERED)
    {
      throw new Exceptions.InvalidStateError(this._session.status);
    }

    this._contentType = contentType;
    this._body = body;

    const extraHeaders = Utils.cloneArray(options.extraHeaders);

    extraHeaders.push(`Content-Type: ${contentType}`);

    this._session.newMessage({
      originator : 'local',
      message       : this,
      request    : this.request
    });

    this._session.sendRequest(JsSIP_C.MESSAGE, {
      extraHeaders,
      eventHandlers : {
        onSuccessResponse : (response) =>
        {
          this.emit('succeeded', {
            originator : 'remote',
            response
          });
        },
        onErrorResponse : (response) =>
        {
          this.emit('failed', {
            originator : 'remote',
            response
          });
        },
        onTransportError : () =>
        {
          this._session.onTransportError();
        },
        onRequestTimeout : () =>
        {
          this._session.onRequestTimeout();
        },
        onDialogError : () =>
        {
          this._session.onDialogError();
        }
      },
      body
    });
  }

  init_incoming(request)
  {
    this._direction = 'incoming';
    this.request = request;

    request.reply(200);

    this._contentType = request.hasHeader('Content-Type') ?
      request.getHeader('Content-Type').toLowerCase() : undefined;
    this._body = request.body;

    this._session.newMessage({
      originator : 'remote',
      message       : this,
      request
    });
  }
};
