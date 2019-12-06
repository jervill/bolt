'use strict'

const test = require('ava').test
const sinon = require('sinon')
const fixtures = require('./fixtures/')
const ParseAction = require('../src/receiver/middleware/parse-action')

const SIGNATURE = 'mysignature'
const TIMESTAMP = Date.now()

test('ParseAction()', t => {
  let mw = ParseAction()
  t.is(mw.length, 3)
})

test('ParseAction() no payload', t => {
  let mw = ParseAction().pop()

  let res = fixtures.getMockRes()
  let sendStub = sinon.stub(res, 'send')

  mw({ body: {} }, res, () => t.fail())
  t.true(sendStub.calledWith('Invalid request: payload missing'))
})

test('ParseAction() invalid json payload', t => {
  let mw = ParseAction().pop()

  let res = fixtures.getMockRes()
  let sendStub = sinon.stub(res, 'send')

  mw({ body: { payload: '\\{"' } }, res, () => t.fail())
  t.true(sendStub.calledWith('Error parsing payload'))
})

test.cb('ParseAction() valid payload', t => {
  t.plan(10)
  let mw = ParseAction().pop()

  let payload = mockPayload()
  let req = {
    body: { payload: JSON.stringify(payload) },
    headers: fixtures.getMockSlackHeaders(SIGNATURE, TIMESTAMP)
  }
  let res = fixtures.getMockRes()

  mw(req, res, () => {
    let slapp = req.slapp

    t.is(slapp.type, 'action')
    t.deepEqual(slapp.body, payload)
    t.is(slapp.meta.verify_token, payload.token)
    t.is(slapp.meta.user_id, payload.user.id)
    t.is(slapp.meta.channel_id, payload.channel.id)
    t.is(slapp.meta.team_id, payload.team.id)
    t.is(slapp.meta.signature, SIGNATURE)
    t.is(slapp.meta.timestamp, TIMESTAMP)
    t.is(slapp.response, res)
    t.is(slapp.responseTimeout, 2500)

    t.end()
  })
})

test.cb('ParseAction() message_action valid payload', t => {
  t.plan(3)
  let mw = ParseAction().pop()

  let payload = mockPayload()
  payload.type = 'message_action'

  let req = { body: { payload: JSON.stringify(payload) } }
  let res = fixtures.getMockRes()

  mw(req, res, () => {
    let slapp = req.slapp
    t.is(slapp.body.type, 'message_action')
    t.deepEqual(slapp.body, payload)
    t.falsy(slapp.response, 'response should be undefined if message_action')
    t.end()
  })
})

test.cb('ParseAction() block_actions valid payload', t => {
  t.plan(5)
  let mw = ParseAction().pop()

  let payload = mockPayload()
  payload.type = 'block_actions'
  payload.actions = [
    {
      action_id: 'actionId',
      block_id: 'blockId',
      value: 'submit'
    }
  ]

  let req = { body: { payload: JSON.stringify(payload) } }
  let res = fixtures.getMockRes()

  mw(req, res, () => {
    let slapp = req.slapp
    t.is(slapp.body.type, 'block_actions')
    t.is(slapp.body.actions[0].value, 'submit')
    t.is(slapp.body.actions[0].name, 'actionId')
    t.is(slapp.body.callback_id, 'blockId')
    t.falsy(slapp.response, 'response should be undefined if block_actions')
    t.end()
  })
})

test.cb('ParseAction() view_submission valid payload', t => {
  t.plan(5)
  let mw = ParseAction().pop()

  let payload = mockViewPayload()
  let req = { body: { payload: JSON.stringify(payload) } }
  let res = fixtures.getMockRes()

  mw(req, res, () => {
    let slapp = req.slapp
    t.is(slapp.body.type, 'modal')
    t.deepEqual(slapp.body.actions[0].selected_options[0], payload.view.state.values)
    t.is(slapp.body.callback_id, 'modal-with-inputs')
    t.is(slapp.response, res)
    t.is(slapp.responseTimeout, 2500)
    t.end()
  })
})

function mockPayload () {
  return {
    token: 'token',
    user: {
      id: 'user_id'
    },
    channel: {
      id: 'channel_id'
    },
    team: {
      id: 'team_id'
    }
  }
}

function mockViewPayload () {
  return {
    type: 'view_submission',
    team: {
      id: 'team_id'
    },
    user: {
      id: 'user_id'
    },
    view: {
      id: 'VNHU13V36',
      type: 'modal',
      title: {
        type: 'plain_text',
        text: 'Modal Menu'
      },
      blocks: [],
      private_metadata: 'shhh-its-secret',
      callback_id: 'modal-with-inputs',
      state: {
        values: {
          'multi-line': {
            'ml-value': {
              type: 'plain_text_input',
              value: 'This is my example inputted value'
            }
          }
        }
      },
      hash: '156663117.cd33ad1f',
      external_id: 'external_id'
    }
  }
}
