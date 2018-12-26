/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { callWithRequestFactory } from '../../lib/call_with_request_factory';
import { isEsErrorFactory } from '../../lib/is_es_error_factory';
import { registerFollowerIndexRoutes } from './follower_index';
import { getFollowerIndexMock, getFollowerIndexListMock } from '../../../fixtures';
import { deserializeFollowerIndex } from '../../lib/follower_index_serialization';

jest.mock('../../lib/call_with_request_factory');
jest.mock('../../lib/is_es_error_factory');
jest.mock('../../lib/license_pre_routing_factory');

const DESERIALIZED_KEYS = Object.keys(deserializeFollowerIndex(getFollowerIndexMock()));

/**
 * Hashtable to save the route handlers
 */
const routeHandlers = {};

/**
 * Helper to extract all the different server route handler so we can easily call them in our tests.
 *
 * Important: This method registers the handlers in the order that they appear in the file, so
 * if a 'server.route()' call is moved or deleted, then the HANDLER_INDEX_TO_ACTION must be updated here.
 */
const registerHandlers = () => {
  let index = 0;

  const HANDLER_INDEX_TO_ACTION = {
    0: 'list',
    1: 'create',
  };

  const server = {
    route({ handler }) {
      // Save handler and increment index
      routeHandlers[HANDLER_INDEX_TO_ACTION[index]] = handler;
      index++;
    },
  };

  registerFollowerIndexRoutes(server);
};

/**
 * Queue to save request response and errors
 * It allows us to fake multiple responses from the
 * callWithRequestFactory() when the request handler call it
 * multiple times.
 */
let requestResponseQueue = [];

/**
 * Helper to mock the response from the call to Elasticsearch
 *
 * @param {*} err The mock error to throw
 * @param {*} response The response to return
 */
const setHttpRequestResponse = (error, response) => {
  requestResponseQueue.push ({ error, response });
};

const resetHttpRequestResponses = () => requestResponseQueue = [];

const getNextResponseFromQueue = () => {
  if (!requestResponseQueue.length) {
    return null;
  }

  const next = requestResponseQueue.shift();
  if (next.error) {
    return Promise.reject(next.error);
  }
  return Promise.resolve(next.response);
};

describe('[CCR API Routes] Follower Index', () => {
  let routeHandler;

  beforeAll(() => {
    isEsErrorFactory.mockReturnValue(() => false);
    callWithRequestFactory.mockReturnValue(getNextResponseFromQueue);
    registerHandlers();
  });

  describe('list()', () => {
    beforeEach(() => {
      routeHandler = routeHandlers.list;
    });

    it('deserializes the response from Elasticsearch', async () => {
      const totalResult = 2;
      setHttpRequestResponse(null, getFollowerIndexListMock(totalResult));

      const response = await routeHandler();
      const autoFollowPattern = response.indices[0];

      expect(response.indices.length).toEqual(totalResult);
      expect(Object.keys(autoFollowPattern)).toEqual(DESERIALIZED_KEYS);
    });
  });

  describe('create()', () => {
    beforeEach(() => {
      resetHttpRequestResponses();
      routeHandler = routeHandlers.create;
    });

    it('should return 200 status when follower index is created', async () => {
      setHttpRequestResponse(null, { acknowledge: true });

      const response = await routeHandler({
        payload: {
          name: 'follower_index',
          remoteCluster: 'remote_cluster',
          leaderIndex: 'leader_index',
        },
      });

      expect(response).toEqual({ acknowledge: true });
    });
  });
});
