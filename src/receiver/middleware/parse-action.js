'use strict'

const bodyParser = require('body-parser')
const verify = require('./body-parser-verify')

module.exports = () => {
  return [
    bodyParser.urlencoded({ extended: true, verify: verify }),
    bodyParser.text({type: '*/*'}),
    function parseAction (req, res, next) {
      let body = req.body

      if (!body || !body.payload) {
        return res.send('Invalid request: payload missing')
      }

      try {
        body = JSON.parse(body.payload)
      } catch (e) {
        return res.send('Error parsing payload')
      }

      // block_actions support:
      // Map the following blockkit body properties (if they exist) to these msg.body poperties
      //   action.action_id to action.name
      //   action.selected_option to action.[selected_option]
      //   action[0].callback_id to callback_id
      if (body.type === 'block_actions' && body.actions) {
        body.actions = body.actions.map(action => {
          return Object.assign({},
            action,
            action.action_id && { name: action.action_id },
            action.selected_option && { selected_options: [action.selected_option] }
          )
        })

        body = Object.assign({},
          body,
          body.actions[0].block_id && { callback_id: body.actions[0].block_id }
        )
      }

      // modal view_submission support:
      // Map the following view properties (if they exist) to these msg.body poperties
      //   view.state.values to action.[selected_options]
      //   view.type to type
      //   view.callback_id to callback_id
      if (body.type === 'view_submission') {
        body.actions = [Object.assign({},
          body.view.state && body.view.state.values && { selected_options: [body.view.state.values] }
        )]
        body.type = body.view.type
        body.callback_id = body.view.callback_id
      }

      req.slapp = {
        type: 'action',
        body: body,
        meta: {
          verify_token: body.token,
          signature: (req.headers || {})['x-slack-signature'],
          timestamp: (req.headers || {})['x-slack-request-timestamp'],
          user_id: body.user.id,
          // View and Modal interactions may not have a channel.
          channel_id: body.channel && body.channel.id,
          team_id: body.team.id
        }
      }

      // message_action & block_actions= do not support returning a message in the HTTP response
      if (!['message_action', 'block_actions'].includes(body.type)) {
        // May be responded to directly within 3000ms
        req.slapp.response = res
        req.slapp.responseTimeout = 2500
      }

      next()
    }
  ]
}
