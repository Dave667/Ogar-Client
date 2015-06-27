if (typeof(game) == 'undefined') game = {};
(function (game) {
  // TODO: sort and simplify variables
  var c2d,
    released = {space: true, w: true, q: true},
    mouse = {x: 0, y: 0, lastX: 0, lastY: 0},
    playing = false,
    initialized = false,
    regions = null,
    selectedRegion = null,
    gameMode = '',
    handler = {},
    nodesOnScreen = [],
    playerCells = [],
    nodes = {},
    nodelist = [],
    leaderboard = {type: false},
    score = 0,
    name = '',
    delay = 500,
    line = {x: 0, y: 0, draw: false, origin: {x: 0, y: 0}};

  game.lastUpdate = 0;
  game.destroyedCells = [];
  game.view = {x: 0, y: 0, zoom: 1};
  game.canvas = undefined;
  game.position = {x: 5000, y: 5000, top: 0, left: 0, right: 10000, bottom: 10000, size: 1};

  game.init = function () {
    this.updateServerList();
    setInterval(this.updateServerList, 18E4);
    this.canvas = document.getElementById('canvas');
    c2d = this.canvas.getContext('2d');
    this.canvas.onmousedown = mouseDown;
    this.canvas.onmousemove = mouseMove;
    window.onkeydown = keyDown;
    window.onkeyup = keyUp;
    window.onblur = blur;
    window.onresize = resize;
    socket.onconnecting = handler.connecting;
    socket.onopen = handler.open;
    socket.onclose = handler.close;
    socket.onaddnode = handler.addNode;
    socket.onclearnodes = handler.clearNodes;
    socket.onupdatenodes = handler.updateNodes;
    socket.onupdateposition = handler.updatePosition;
    socket.onupdateleaderboard = handler.updateLeaderboard;
    socket.ondrawline = handler.drawLine;
    socket.onsetborder = handler.setBorder;
    socket.onchatmessage = handler.chatMessage;
    if (/firefox/i.test(navigator.userAgent)) {
      document.addEventListener("DOMMouseScroll", mouseWheel, false);
    } else {
      document.body.onmousewheel = mouseWheel;
    }
    resize();
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(animationFrame);
    } else {
      setInterval(this.draw, 100 / 6);
    }
    setInterval(sendMouse(), 40);
    loadRegion();
    this.setRegion(document.getElementById('region').value);
    initialized = true;
    if (!socket.isOpen()) {
      tools.dialogs.showConnecting(true);
      tryConnect();
    }
  };

  game.deleteCell = function (cell) {
    // TODO:
  };

  game.start = function (name) {
    tools.dialogs.showDialogs(false);
    socket.sendName(name);
    // score = 0
    // TODO:
  };

  function colorToStr(color) {
    if (color && color.hasOwnProperty('r') && color.hasOwnProperty('g') && color.hasOwnProperty('b')) {
      var ret = (color.r << 16 | color.g << 8 | color.b).toString(16);
      while (ret.length > 6) {
        ret = '0' + ret;
      }
      ret = '#' + ret;
      return ret;
    }
  }

  handler.connecting = function () {
    // reset everything
    nodesOnScreen = [];
    playerCells = [];
    nodes = {};
    nodelist = [];
    game.destroyedCells = [];
    leaderboard = [];
    score = 0;
    line.draw = false;
    playing = true;
  };

  handler.open = function () {
    socket.sendName(name);
    document.getElementById('playBtn').disabled = false;
    tools.dialogs.showConnecting(false);
  };

  handler.close = function () {
    document.getElementById('playBtn').disabled = true;
    tools.dialogs.showConnecting(true);
    setTimeout(tryConnect, delay);
    delay += 1.5;
  };

  handler.addNode = function (ret) {
    nodesOnScreen.push(ret.id);
  };

  handler.clearNodes = function () {
    playerCells = [];
    nodesOnScreen = [];
  };

  handler.updateNodes = function (ret) {
    game.lastUpdate = ret.timestamp;
    // kills
    for (var i = 0; i < ret.kills.length; i++) {
      var killer = nodes[ret.kills[i].killer];
      var killed = nodes[ret.kills[i].nodeId];
      if (killer && killed) {
        killed.destroy();
        killed.last.x = killed.x;
        killed.last.y = killed.y;
        killed.last.size = killed.size;
        killed.next.x = killer.x;
        killed.next.y = killer.y;
        killed.next.size = killed.size;
        killed.update = game.lastUpdate;
      }
    }

    // add or update nodes
    for (var i = 0; i < ret.updates.length; i++) {
      var node = null,
        item = ret.updates[i];
      if (nodes.hasOwnProperty(item.nodeId)) {
        node = nodes[item.nodeId];
        node.updatePos();
        node.last.x = node.x;
        node.last.y = node.y;
        node.last.size = node.size;
        node.color = colorToStr(item.color);
      } else {
        node = new entity.Cell(item.nodeId, item.position, item.size, colorToStr(item.color), item.name);
        nodelist.push(node);
        nodes[item.nodeId] = node;
      }
      node.isVirus = item.isVirus;
      node.isAgitated = item.isAgitated;
      node.next = item.position;
      node.next.x = item.position.x;
      node.next.y = item.position.y;
      node.next.size = item.size;
      node.update = game.lastUpdate;
      if (item.name) {
        node.name = item.name;
      }
      if (nodesOnScreen.indexOf(item.nodeId) > -1 && playerCells.indexOf(node) == -1) {
        tools.dialogs.showDialogs(false);
        playerCells.push(node);
        if (playerCells.length == 1) {
          game.view.x = node.x;
          game.view.y = node.y;
        }
      }
      if (playing && playerCells.length == 0) {
        tools.dialogs.showDialogs(true);
      }
    }

    // remove nodes
    for (var i = 0; i < ret.remove.length; i++) {
      node = nodes[ret.remove[i]];
      if (node) {
        node.destroy;
      }
    }
  };

  handler.updatePosition = function (ret) {
    game.position.x = ret.x;
    game.position.y = ret.y;
    game.position.size = ret.size;
  };

  handler.updateLeaderboard = function (ret) {
    leaderboard = ret;
  };

  handler.drawLine = function (ret) {
    line.x = ret.x;
    line.y = ret.y;
    if (!line.draw) {
      line.draw = true;
      line.origin.x = ret.x;
      line.origin.y = ret.y;
    }
  };

  handler.setBorder = function (ret) {
    game.position.top = ret.top;
    game.position.bottom = ret.bottom
    game.position.left = ret.left;
    game.position.right = ret.right;
    game.position.x = (ret.left + ret.right) / 2;
    game.position.y = (ret.top + ret.bottom) / 2;
    game.position.size = 1;
    if (playerCells.length == 0) {
      game.view.x = game.position.x;
      game.view.y = game.position.y;
      game.view.zoom = game.position.size;
    }
  };

  handler.chatMessage = function (ret) {
    // TODO: implement...
    tools.logging.log(ret);
  };

  function loadRegion() {
    if (selectedRegion) {
      game.setRegion(selectedRegion, true);
    }
    if (typeof(Storage) !== 'undefined' && window.localStorage.hasOwnProperty('selectedRegion')) {
      game.setRegion(window.localStorage.selectedRegion, true);
    }
  }

  game.setRegion = function (region, force) {
    if (region && (region != selectedRegion || force)) {
      var regionSelect = document.getElementById('region');
      if (regionSelect && regionSelect.value != region) {
        regionSelect.value = region;
      }
      selectedRegion = region;
      window.localStorage.selectedRegion = region;
      if (!socket.isOpen()) {
        tools.dialogs.showConnecting(true);
        tryConnect();
      }
    }
  };

  function tryConnect() {
    if (config.masterServer) {
      tools.logging.log('Searching a server for ' + selectedRegion + gameMode);
    }
    servers.getServer(function (ret) {
      socket.connect(ret[0]);
    }, selectedRegion, gameMode);
  }

  function animationFrame() {
    game.draw();
    window.requestAnimationFrame(animationFrame);
  }

  game.draw = function () {
    // TODO
  };

  function mouseDown(event) {
    updateMouse(event.clientX, event.clientY);
    sendMouse();
  }

  function mouseMove(event) {
    updateMouse(event.clientX, event.clientY);
  }

  function keyDown(event) {
    if (playing) {
      switch (event.keyCode) {
        case 32: // space
          if (released.space) {
            sendMouse();
            socket.sendEvent(socket.event.pressSpace);
            released.space = false;
          }
          break;
        case 81: // q
          if (released.q) {
            socket.sendEvent(socket.event.pressQ);
            released.q = false;
          }
          break;
        case 87: // w
          if (released.w) {
            sendMouse();
            socket.sendEvent(socket.event.pressW);
            released.w = false;
          }
          break;
      }
    }
  }

  function keyUp(event) {
    if (playing) {
      switch (event.keyCode) {
        case 32: // space
          released.space = true;
          break;
        case 81: // q
          if (!released.q) {
            socket.sendEvent(socket.event.releaseQ);
            released.q = true;
          }
          break;
        case 87: // w
          released.w = true;
          break;
      }
    }
  }

  function blur() {
    if (!released.q) {
      socket.sendEvent(socket.event.releaseQ);
    }
    released.q = true;
    released.space = true;
    released.w = true;
  }

  function resize() {
    game.canvas.width = window.innerWidth;
    game.canvas.height = window.innerHeight;
    game.draw();
  }

  function mouseWheel(event) {
    // TODO: add code for zooming
  }

  function updateMouse(rawX, rawY) {
    mouse.x = (rawX - game.canvas.width / 2);
    mouse.y = (rawY - game.canvas.height / 2);
  }

  function hasMouseMoved() {
    if (Math.abs(mouse.x - mouse.lastX) < 0.01) {
      return false;
    }
    if (Math.abs(mouse.y - mouse.lastY) < 0.01) {
      return false;
    }
    if (mouse.x * mouse.x + mouse.y * mouse.y <= 64) {
      return false;
    }
    return true;
  }

  function sendMouse() {
    if (playing && hasMouseMoved()) {
      socket.sendMouse(mouse.x, mouse.y);
      console.log(x, y);
    }
  }

  game.updateServerList = function () {
    if (regions == null) {
      regions = {};
      var region = document.getElementById('region').firstElementChild;
      do {
        if (region.value) {
          if (region.textContent) {
            regions[region.value] = region.textContent;
          } else {
            regions[region.value] = region.innerText;
          }
        }
      } while (region = region.nextElementSibling != null);
      servers.getRegions(function (ret) {
        if (ret != null) {
          var stats = {};
          for (var region in ret.regions) {
            var name = region.split(':')[0];
            stats[name] = ret.regions[region];
          }
          for (var stat in stats) {
            var element = document.querySelector('#region option[value="' + stat + '"');
            if (element) {
              element.innerHTML = regions[stat] + " (" + stats[stat].numPlayers + " players)";
            }
            // TODO: remove empty or non-existent options
          }
        }
      });
    }
  }
}(game));