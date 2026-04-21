import ReconnectingWebSocket from 'reconnecting-websocket';
import useStore from './store';
import { wsUrl } from './api';

const ws = new ReconnectingWebSocket(wsUrl());

ws.onmessage = (evt) => {
  const data = JSON.parse(evt.data);
  if (data.type === 'snapshot') {
    useStore.getState().loadSnapshot(data.agents);
  } else {
    useStore.getState().handleEvent(data);
  }
};

ws.onopen = () => useStore.getState().setConnected(true);
ws.onclose = () => useStore.getState().setConnected(false);
