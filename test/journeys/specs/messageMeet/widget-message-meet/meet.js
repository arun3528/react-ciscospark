/* eslint-disable max-nested-callbacks */
import {assert} from 'chai';
import testUsers from '@ciscospark/test-helper-test-users';
import '@ciscospark/plugin-phone';
import {switchToMeet} from '../../../lib/menu';
import {clearEventLog, getEventLog} from '../../../lib/events';

describe(`Widget Message Meet`, () => {
  const browserLocal = browser.select(`browserLocal`);
  const browserRemote = browser.select(`browserRemote`);
  let mccoy, spock;
  process.env.CISCOSPARK_SCOPE = [
    `webexsquare:get_conversation`,
    `Identity:SCIM`,
    `spark:people_read`,
    `spark:rooms_read`,
    `spark:rooms_write`,
    `spark:memberships_read`,
    `spark:memberships_write`,
    `spark:messages_read`,
    `spark:messages_write`,
    `spark:teams_read`,
    `spark:teams_write`,
    `spark:team_memberships_read`,
    `spark:team_memberships_write`,
    `spark:kms`
  ].join(` `);

  before(`load browsers`, () => {
    browser
      .url(`/message-meet.html`)
      .execute(() => {
        localStorage.clear();
      });
  });

  before(`create spock`, () => testUsers.create({count: 1, displayName: `spock`})
    .then((users) => {
      [spock] = users;
    }));

  before(`create mccoy`, () => testUsers.create({count: 1, displayName: `mccoy`})
    .then((users) => {
      [mccoy] = users;
    }));

  before(`pause to let test users establish`, () => browser.pause(5000));

  before(`inject token`, () => {
    browserLocal.execute((localAccessToken, localToUserEmail) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push(eventName);
        },
        toPersonEmail: localToUserEmail,
        initialActivity: `message`
      };
      window.openWidgetMessageMeet(options);
    }, spock.token.access_token, mccoy.email);

  });

  describe(`meet widget`, () => {
    const meetWidget = `.ciscospark-meet-component-wrapper`;
    const messageWidget = `.ciscospark-message-component-wrapper`;
    const callButton = `button[aria-label="Call"]`;
    const answerButton = `button[aria-label="Answer"]`;
    const declineButton = `button[aria-label="Decline"]`;
    const hangupButton = `button[aria-label="Hangup"]`;
    const callControls = `.call-controls`;
    const remoteVideo = `.remote-video video`;

    describe(`pre call experience`, () => {
      before(`switch to meet widget`, () => {
        // Wait for conversation to be established before continuing
        browserLocal.waitForVisible(`[placeholder="Send a message to ${mccoy.displayName}"]`);
        switchToMeet(browserLocal);
      });

      it(`has a call button`, () => {
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
      });
    });

    describe(`during call experience`, () => {
      before(`open remote widget`, () => {
        browserRemote.execute((localAccessToken, localToUserEmail) => {
          const options = {
            accessToken: localAccessToken,
            onEvent: (eventName) => {
              window.ciscoSparkEvents.push(eventName);
            },
            toPersonEmail: localToUserEmail,
            initialActivity: `message`
          };
          window.openWidgetMessageMeet(options);
        }, mccoy.token.access_token, spock.email);
        browserRemote.waitForVisible(`[placeholder="Send a message to ${spock.displayName}"]`);
      });

      beforeEach(`switch to meet widget local`, () => {
        // widget switches to message after hangup
        switchToMeet(browserLocal);
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
      });

      beforeEach(`switch to meet widget remote`, () => {
        // widget switches to message after hangup
        switchToMeet(browserRemote);
        browserRemote.element(meetWidget).element(callButton).waitForVisible();
      });

      it(`can hangup before answer`, () => {
        browserLocal.element(meetWidget).element(callButton).click();
        // wait for call to establish
        browserRemote.waitForVisible(answerButton);
        // Call controls currently has a hover state
        browserLocal.moveTo(browserLocal.element(meetWidget).value.ELEMENT);
        browserLocal.waitForVisible(callControls);
        browserLocal.element(meetWidget).element(hangupButton).click();
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
      });

      it(`can decline an incoming call`, () => {
        browserRemote.element(meetWidget).element(callButton).click();
        browserLocal.waitForVisible(declineButton);
        browserLocal.element(meetWidget).element(declineButton).click();
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
        // Pausing to let locus session flush
        browserLocal.pause(20000);
      });

      it(`can hangup in call`, () => {
        clearEventLog(browserLocal);
        browserLocal.element(meetWidget).element(callButton).click();
        browserRemote.waitForVisible(answerButton);
        browserRemote.element(meetWidget).element(answerButton).click();
        browserRemote.waitForVisible(remoteVideo);
        // Let call elapse 5 seconds before hanging up
        browserLocal.pause(5000);
        browserLocal.moveTo(browserLocal.element(meetWidget).value.ELEMENT);
        browserLocal.waitForVisible(callControls);
        browserLocal.element(meetWidget).element(hangupButton).click();
        // Should switch back to message widget after hangup
        browserLocal.waitForVisible(messageWidget);
        const events = getEventLog(browserLocal);
        assert.include(events, `calls:ringing`, `has a calls ringing event`);
        assert.include(events, `calls:connected`, `has a calls connected event`);
        assert.include(events, `calls:disconnected`, `has a calls disconnected event`);
      });
    });
  });
});
