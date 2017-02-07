const TwitterClient = require("./config.js");
const PromptSync = require("prompt-sync")();
const BSP = require("bluetooth-serial-port");
const Bluetooth = new BSP.BluetoothSerialPort();
const MASTER = "damienestewart"; // Twitter username that can issue disconnect message.

/*
 * Define constants and necessary functions. I should do this in a different file...
 * Not enough coffee.
 */
const BEEP = new Buffer([0x06, 0x00, 0x80, 0x03, 0x0B, 0x02, 0xF4, 0x01]);

/*
 * Movement buffers have data that control both wheels.
 */
const MOVE_FORWARD = new Buffer([
  0x0C, 0x00, 0x80, 0x04, 0x00, 0x64, 0x05, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00,
  0x0C, 0x00, 0x80, 0x04, 0x02, 0x64, 0x05, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00]);

const MOVE_BACKWARD = new Buffer([
  0x0C, 0x00, 0x80, 0x04, 0x00, 0x9C, 0x05, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00,
  0x0C, 0x00, 0x80, 0x04, 0x02, 0x9C, 0x05, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00]);

const STOP = new Buffer([
  0x0C, 0x00, 0x80, 0x04, 0x00, 0x00, 0x07, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00,
  0x0C, 0x00, 0x80, 0x04, 0x02, 0x00, 0x07, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00]);

const TURN_LEFT = new Buffer([
  0x0C, 0x00, 0x80, 0x04, 0x00, 0x64, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00,
  0x0C, 0x00, 0x80, 0x04, 0x02, 0x9C, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00]);

const TURN_RIGHT = new Buffer([
  0x0C, 0x00, 0x80, 0x04, 0x00, 0x9C, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00,
  0x0C, 0x00, 0x80, 0x04, 0x02, 0x64, 0x01, 0x00,
  0x00, 0x20, 0x00, 0x00, 0x00, 0x00]);

var DEVICE_BUSY = false; // track whether or not the device is processing a command.
var deviceList = []; // store devices found after an inquiry.
var COMMANDS = {
  "forward": 0,
  "backward": 0,
  "right": 0,
  "left": 0,
  "turn_around": 0
};

/*
 * Functions for moving the robot.
 */
var moveForward = function() {
  DEVICE_BUSY = true;
  Bluetooth.write(MOVE_FORWARD, function(err, bytes) {});
  stopDeviceMotion(3000);
}

var moveReverse = function() {
  DEVICE_BUSY = true;
  Bluetooth.write(MOVE_BACKWARD, function(err, bytes) {});
  stopDeviceMotion(3000);
}

var turnLeft = function() {
  DEVICE_BUSY = true;
  Bluetooth.write(TURN_LEFT, function(err, bytes) {});
  stopDeviceMotion(500);
}

var turnRight = function() {
  DEVICE_BUSY = true;
  Bluetooth.write(TURN_RIGHT, function(err, bytes) {});
  stopDeviceMotion(500);
}

var turnAround = function() {
  DEVICE_BUSY = true;
  Bluetooth.write(TURN_RIGHT, function(err, bytes) {});
  stopDeviceMotion(1000);
}

var COMMAND_LIST = {
  "forward": moveForward,
  "backward": moveReverse,
  "right": turnRight,
  "left": turnLeft,
  "turn_around": turnAround
}

/*
 * After every movement, stop the robot after a certain amount of time.
 */
var stopDeviceMotion = function(timeLimit) {
  setTimeout(function(timeLimit) {
    Bluetooth.write(STOP, function(err, bytes) {});
    DEVICE_BUSY = false;
  }, timeLimit);
}

/*
 * Begin watching twitter. This requires the information in config.js, so make sure
 * that information is correct.
 */
var startTwitterStream = function() {
  TwitterClient.stream('user').on('data', function(event) {
    var text = event.text.toLowerCase();
    var username = event.user.screen_name;

    // the first part of the text is the screen name, so remove it.
    text = text.split(" ")[1];
    if (text) {
      /* process commands */
      if (DEVICE_BUSY) {
        console.log("@" + username + " told me to [" + text + "]. But I am busy right now. It'll have to wait.");
      }

      if (text == "disconnect" && username == MASTER) {
        console.log("Recieved disconnect message from Master. Goodbye!");
        return Bluetooth.close();
      } else if (text == "forward") {
        COMMANDS.forward = COMMANDS.forward + 1;
      } else if (text == "reverse") {
        COMMANDS.backward = COMMANDS.backward + 1;
      } else if (text == "left") {
        COMMANDS.left = COMMANDS.left + 1;
      } else if (text == "right") {
        COMMANDS.right = COMMANDS.right + 1;
      } else if (text == "beep") {
        Bluetooth.write(new Buffer(BEEP), function(err, bytes) {});
      } else if (text == "turn-around") {
        COMMANDS.turn_around = COMMANDS.turn_around + 1;
      }
      console.log("@" + username + " told me to [" + text + "].");
      console.log(COMMANDS);
    }
  }).on('error', function(error) {
    console.log(error);
  });

  setInterval(function() {
    callNextCommand();
  }, 2000);
}

/*
 * This is called every 2 seconds to read the most popular command
 * issued to the robot and call it.
 */
var callNextCommand = function() {
  console.log("Checking for command to execute...");

  var command = null;
  var count = null;

  for (var k in COMMANDS) {
    if (command == null && count == null) {
      command = k;
      count = COMMANDS[k];
    } else if (COMMANDS[k] > count) {
      command = k;
      count = COMMANDS[k];
    }
  }

  if (count == 0) {
    return;
  }

  if (DEVICE_BUSY) {
    return;
  }

  console.log("Calling most popular command: " + command);
  COMMAND_LIST[command]();
  for (var k in COMMANDS) {
    COMMANDS[k] = 0;
  }
}

/* Connect to a device. */
var connectToDevice = function(address, channel) {
  Bluetooth.connect(address, channel, function() {
    console.log("Connected!");

    // connect to twitter
    startTwitterStream();

  }, function(err) {
    console.log("Could not establish a connection.");
    console.log(err);
    return console.log("An error occurred while trying to establish a connection, exiting.");
  });
}

console.log("Attempting device discovery...");

// Set 'found' event listener.
Bluetooth.on('found', function(address, name) {
  deviceList.push({address: address, name: name});
}).on('finished', function() {
  console.log("Device discovery completed.\n");

  if (deviceList.length == 0) {
    console.log("Could not find any Bluetooth devices.");
    return console.log("Please ensure that the device is on and in range, and try again.");
  } else if (deviceList.length == 1) {
    var name = deviceList[0].name;
    var address = deviceList[0].address;

    console.log("Discovered device, " + name + ", at address: " + address + ".");
    var choice = PromptSync("Would you like to connect to this device (yes/no)? ");

    while (choice != "yes" && choice != "no") {
      console.log("Invalid option.");
      choice = PromptSync("Would you like to connect to this device (yes/no)? ");
    }

    if (choice == "no") {
      console.log("Have a great day!");
    } else {
      console.log("Connecting to " + name + "...");
      // start attempt to establish connection here.
      Bluetooth.findSerialPortChannel(address, function(channel) {
        console.log("Channel " + channel);
        console.log("Found serial port channel... establishing connection.");

        // attempt to establish connection.
        connectToDevice(address, channel);

      }, function(err) {
        console.log("Could not find a serial port channel.");
        console.log("Error: " + err);
        return console.log("An error occurred while trying to find a serial port channel, exiting.");
      });

    }
  } else {
    console.log("Discovered devices:");

    for(var i = 0; i < deviceList.length; i++) {
      console.log((i+1) + ". " + deviceList[i].name + ": " + deviceList[i].address);
    }

    console.log("Which device would you like to connect to?");
    var choice = PromptSync("Enter a number from " + 1 + "-" + deviceList.length + ": ");

    while (choice < 1 || choice > deviceList.length) {
      console.log("Invalid option.");
      choice = PromptSync("Enter a number from " + 1 + "-" + deviceList.length + ": ");
    }


    var name = deviceList[choice-1].name;
    var address = deviceList[choice-1].address;
    console.log("Connecting to " + name + "...");

    Bluetooth.findSerialPortChannel(address, function(channel) {
      console.log("Channel " + channel);
      console.log("Found serial port channel... establishing connection.");

      // attempt to establish connection.
      connectToDevice(address, channel);

    }, function(err) {
      console.log("Could not find a serial port channel.");
      console.log("Error: " + err);
      return console.log("An error occurred while trying to find a serial port channel, exiting.");
    });
  }

// Set on closed event to fire when the Bluetooth connectio has ended.
}).on('closed', function() {
  console.log("Closing Bluetooth connection. Goodbye!");
  process.exit();
});
Bluetooth.inquire(); // start the bluetooth device inquiry.

// catch ctrl + c interrupt.
process.on('SIGINT', function() {
    console.log("\nCaught interrupt signal!");
    if (Bluetooth.isOpen()) {
      Bluetooth.close();
    }
    process.exit();
});
