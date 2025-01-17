/*
 * Copyright (c) 2018-2020 Swiss Federal Railways
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 *  SPDX-License-Identifier: EPL-2.0
 */
import { concat, EMPTY, from, MonoTypeOperatorFunction, Observable, of, OperatorFunction, pipe } from 'rxjs';
import { filter, map, mergeMap, mergeMapTo, publishLast, refCount, take } from 'rxjs/operators';
import { MessageEnvelope, MessagingChannel, MessagingTransport } from './ɵmessaging.model';
import { Message, TopicMessage } from './messaging.model';
import { TopicMatcher } from './topic-matcher.util';

/** @ignore */
export function filterByChannel<T extends Message>(channel: MessagingChannel): OperatorFunction<MessageEnvelope, MessageEnvelope<T>> {
  return filter((envelope: MessageEnvelope): envelope is MessageEnvelope<T> => envelope.channel === channel);
}

/** @ignore */
export function filterByTransport(transport: MessagingTransport): MonoTypeOperatorFunction<MessageEvent> {
  return filter((event: MessageEvent): boolean => {
    const envelope: MessageEnvelope = event.data;
    return envelope && envelope.transport === transport;
  });
}

/** @ignore */
export function filterByTopic<T>(topic: string): OperatorFunction<MessageEnvelope, TopicMessage<T>> {
  return pipe(
    filterByChannel<TopicMessage>(MessagingChannel.Topic),
    filter(envelope => new TopicMatcher(topic).match(envelope.message.topic).matches),
    pluckMessage(),
  );
}

/** @ignore */
export function pluckMessage<T extends Message>(): OperatorFunction<MessageEnvelope<T>, T> {
  return map((envelope: MessageEnvelope<T>): T => {
    return envelope.message;
  });
}

/** @ignore */
export function pluckEnvelope<T extends Message>(): OperatorFunction<MessageEvent, MessageEnvelope<T>> {
  return map((messageEvent: MessageEvent): MessageEnvelope<T> => {
    return messageEvent.data;
  });
}

/** @ignore */
export function filterByOrigin(origin: string): MonoTypeOperatorFunction<MessageEvent> {
  return filter((event: MessageEvent): boolean => {
    return event.origin === origin;
  });
}

/** @ignore */
export function filterByHeader<T extends Message>(header: { key: string, value: any }): MonoTypeOperatorFunction<T> {
  return filter((message: T): boolean => {
    return message.headers.has(header.key) && message.headers.get(header.key) === header.value;
  });
}

/**
 * Buffers the source Observable values until `closingNotifier$` emits.
 * Once closed, items of the source Observable are emitted as they arrive.
 * @ignore
 */
export function bufferUntil<T>(closingNotifier$: Observable<any> | Promise<any>): MonoTypeOperatorFunction<T> {
  const guard$ = from(closingNotifier$).pipe(take(1), publishLast(), refCount(), mergeMapTo(EMPTY));
  return mergeMap((item: T) => concat(guard$, of(item)));
}
