const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual worker behind separate client contexts and a mocked Chrome transport.
module.exports = function attachPreferencesWorker(chrome) {
  let receive;
  const context = vm.createContext({
    chrome: { storage: chrome.storage, runtime: {
      id: 'test-extension', onMessage: { addListener: listener => { receive = listener; } },
    } },
    importScripts: file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../preferences-worker.js'), 'utf8'), context);
  const send = (message, sender = { id: 'test-extension' }) => new Promise(resolve => {
    if (!receive(message, sender, resolve)) resolve(undefined);
  });
  chrome.runtime ||= {};
  chrome.runtime.sendMessage = send;
  return send;
};
