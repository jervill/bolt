'use strict'

const bodyParser = require('body-parser')
const verify = require('./body-parser-verify')

module.exports = () => {
  return [
    bodyParser.urlencoded({ extended: true, verify: verify }),
    function parseOptions (req, res, next) {
      let body = req.body

      if (!body || !body.payload) {
        return next(new Error('Invalid request: payload missing'))
      }

      try {
        body = JSON.parse(body.payload)
      } catch (e) {
        return next(new Error('Error parsing payload'))
      }

      // block_suggestions support:
      // Map the following blockkit body properties (if they exist) to these msg.body poperties
      //   action_id to name
      //   block_id to callback_id
      if (body.type === 'block_suggestion') {
        body = Object.assign({},
          body,
          body.action_id && { name: body.action_id },
          body.block_id && { callback_id: body.block_id }
        )
      }

      req.slapp = {
        type: 'options',
        body: body,
        meta: {
          verify_token: body.token,
          signature: (req.headers || {})['x-slack-signature'],
          timestamp: (req.headers || {})['x-slack-request-timestamp'],
          user_id: body.user && body.user.id,
          channel_id: body.channel && body.channel.id,
          team_id: body.team && body.team.id
        },
        // Options must be handled very quickly within ???
        response: res,
        responseTimeout: 3000
      }

      next()
    }
  ]
}
