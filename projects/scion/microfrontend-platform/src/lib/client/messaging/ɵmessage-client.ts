/*
 * Copyright (c) 2018-2020 Swiss Federal Railways
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 *  SPDX-License-Identifier: EPL-2.0
 */
import { defer, Observable, Subscription } from 'rxjs';
import { IntentMessage, mapToBody, throwOnErrorStatus, TopicMessage } from '../../messaging.model';
import { BrokerGateway } from './broker-gateway';
import { Defined } from '@scion/toolkit/util';
import { MessagingChannel, PlatformTopics } from '../../ɵmessaging.model';
import { TopicMatcher } from '../../topic-matcher.util';
import { MessageClient, PublishOptions, RequestOptions } from './message-client';
import { Beans } from '@scion/toolkit/bean-manager';
import { MessageHandler } from './message-handler';

export class ɵMessageClient implements MessageClient { // tslint:disable-line:class-name

  constructor(private readonly _brokerGateway: BrokerGateway) {
  }

  public publish<T = any>(topic: string, message?: T, options?: PublishOptions): Promise<void> {
    assertTopic(topic, {allowWildcardSegments: false});
    const headers = new Map(options?.headers || []);
    const topicMessage: TopicMessage = {topic, retain: Defined.orElse(options && options.retain, false), headers};
    setBodyIfDefined(topicMessage, message);
    return this._brokerGateway.postMessage(MessagingChannel.Topic, topicMessage);
  }

  public request$<T>(topic: string, request?: any, options?: RequestOptions): Observable<TopicMessage<T>> {
    assertTopic(topic, {allowWildcardSegments: false});
    // IMPORTANT:
    // When sending a request, the platform adds various headers to the message. Therefore, to support multiple subscriptions
    // to the returned Observable, each subscription must have its individual message instance and headers map.
    // In addition, the headers are copied to prevent modifications before the effective subscription.
    const headers = new Map(options?.headers || []);
    return defer(() => {
      const topicMessage: TopicMessage = {topic, retain: false, headers};
      setBodyIfDefined(topicMessage, request);
      return this._brokerGateway.requestReply$(MessagingChannel.Topic, topicMessage).pipe(throwOnErrorStatus());
    });
  }

  public observe$<T>(topic: string): Observable<TopicMessage<T>> {
    assertTopic(topic, {allowWildcardSegments: true});
    return this._brokerGateway.subscribeToTopic<T>(topic);
  }

  public onMessage<IN = any, OUT = any>(topic: string, callback: (message: TopicMessage<IN>) => Observable<OUT> | Promise<OUT> | OUT | void): Subscription {
    return new MessageHandler<TopicMessage<IN>, OUT>(Beans.get(MessageClient).observe$<IN>(topic), callback).subscription;
  }

  public subscriberCount$(topic: string): Observable<number> {
    assertTopic(topic, {allowWildcardSegments: false});
    return this.request$<number>(PlatformTopics.RequestSubscriberCount, topic).pipe(mapToBody());
  }
}

function assertTopic(topic: string, options: { allowWildcardSegments: boolean }): void {
  if (topic === undefined || topic === null || topic.length === 0) {
    throw Error('[IllegalTopicError] Topic must not be `null`, `undefined` or empty');
  }

  if (!options.allowWildcardSegments && TopicMatcher.containsWildcardSegments(topic)) {
    throw Error(`[IllegalTopicError] Topic not allowed to contain wildcard segments. [topic='${topic}']`);
  }
}

function setBodyIfDefined<T>(message: TopicMessage<T> | IntentMessage<T>, body?: T): void {
  if (body !== undefined) {
    message.body = body;
  }
}
