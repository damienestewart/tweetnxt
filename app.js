var TwitterClient = require("./config.js");
var Bluetooth = require("node-bluetooth");
var PromptSync = require("prompt-sync")();

const LocalDevice = new Bluetooth.DeviceINQ();

var printNXTDevicesList = function(list) {
  for(var i = 0; i < list.length; i++) {
    console.log("------------------------------------------------");
    var name = list[i].name;
    var address = list[i].address;
    var services = list[i].services;

    console.log((i+1) + ".");
    console.log("   Device Name: " + name);
    console.log("   Device Address: " + address);
    console.log("   Device Services: " + JSON.stringify(services));
  }
}

var processNXTDeviceList = function(list) {
  if (list.length == 0) {
    console.log("This laptop has not paired with any NXT devices.");
    console.log("Ensure that an NXT device is on with Bluetooth enabled.");
    console.log("If the device does not have 'NXT' in the name, it will not be discovered.");

    var quit = PromptSync("Press enter to start the inquiry (enter 'q' to quit) ");

    if (quit == 'q' || quit == 'Q') {
      return console.log("Have a great day!");
    }

    startDeviceInquiry(); // start inquiry for bluetooth devices.
  } else {
    if (list.length == 1) {
      console.log("Would you like to connect to this device?");
      console.log("Device Name: " + list[0].name);
      console.log("Device Address: " + list[0].address);
      var choice = PromptSync("Please enter 'yes', 'no', or 'q' to quit: ");

      while(choice != 'yes' && choice != 'no' && choice != 'q') {
        console.log('Invalid option.');
        choice = PromptSync("Please enter 'yes', 'no', or 'q' to quit: ");
      }

      if (choice == 'yes') {
        connectToDevice(list[0].name, list[0].address);
      } else {
        return console.log('Have a great day!');
      }

    } else {
      console.log("Which NXT device would you like to connect to?");
      printNXTDevicesList(list);
      var choice = PromptSync("Enter a number from 1-" + list.length + " (or q to quit): ");
      while (choice < 1 || choice > list.length) {
        console.log("Invalid option.");
        choice = PromptSync("Enter a number from 1-" + list.length + " (or q to quit): ");
      }
      if (choice == 'q' || choice == 'Q') {
        return console.log('Have a great day!');
      }
      connectToDevice(list[choice-1].name, list[choice-1].address);
    }
  }
}

var processDiscoveredDevices = function(list) {
  if (list.length == 0) {
    return console.log("No NXT devices found.");
  }

  if (list.length == 1) {
    console.log("Would you like to connect to this device?");
    console.log("Device Name: " + list[0].name);
    console.log("Device Address: " + list[0].address);
    var choice = PromptSync("Please enter 'yes', 'no', or 'q' to quit: ");

    while(choice != 'yes' && choice != 'no' && choice != 'q') {
      console.log('Invalid option.');
      choice = PromptSync("Please enter 'yes', 'no', or 'q' to quit: ");
    }

    if (choice == 'yes') {
      connectToDevice(list[0].name, list[0].address);
    } else {
      return console.log('Have a great day!');
    }
  } else {
    console.log("Discovered devices:");
    for (var i = 0; i < list.length; i++) {
      console.log((i+1) + ".");
      console.log("------------------------------------------------");
      console.log("   Device Name: " + list[i].name);
      console.log("   Device Address: " + list[i].address);
    }

    var choice = PromptSync("Please choose a device (enter a number from 1-" + (list.length-1) + ", or q to quit)): ");
    while(choice < 1 || choice > list.length) {
      console.log("Invalid option.");
      choice = PromptSync("Please choose a device (enter a number from 1-" + (list.length-1) + ", or q to quit): ");
    }
    if (choice == 'q' || choice == 'Q') {
      return console.log('Have a great day!');
    }
    choice = Math.floor(choice);
    connectToDevice(list[choice-1].name, list[choice-1].address);
  }
}

var startDeviceInquiry = function() {
  var deviceList = [];
  console.log("Starting device inquiry...");

  LocalDevice.on('finished', function() {
    console.log('Inquiry complete.');
    processDiscoveredDevices(deviceList);
  }).on('found', function(deviceAddress, deviceName) {
    console.log('Found');
    console.log(deviceName);

    if (deviceName && deviceName.includes("NXT")) {
      deviceList.push({'address': deviceAddress, 'name': deviceName})
    }
  }).inquire();
}

var connectToDevice = function(deviceName, deviceAddress) {
  LocalDevice.findSerialPortChannel(deviceAddress, function(channel) {
    console.log("Attempting to connect to " + deviceName + " on channel " + channel + "...");
    Bluetooth.connect(deviceAddress, channel, function(err, connection) {
      if (err) {
        console.log("An error occurred.");
        console.log(err);
        return  console.log("Exiting. Please try again later."); // in the future handle this error and ask to connect to a diff device
      }

      console.log("Established connection with " + deviceName + " on channel " + channel + ".")
      connection.write(new Buffer([0x06, 0x00, 0x80, 0x03, 0x0B, 0x02, 0xF4, 0x01]));


    });
  });
}

var connectToTwitter = function(connection) {
  console.log("Establishing twitter connection - @tweetnxt...")
  var stream = TwitterClient.stream('user');
  stream.on('data', function(event) {
    /* process commands */
    console.log(event);
  }).on('error', function(error) {
    console.log(error);
  })
}

LocalDevice.listPairedDevices(function(list) {
  var nxtList = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].name && list[i].name.includes("NXT")) {
      nxtList.push(list[i]);
    }
  }
  processNXTDeviceList(nxtList);
});


// device.on('finished',  console.log.bind(console, 'finished'))
// .on('found', function found(address, name){
//
//   if (name == 'NXT') {
//
//     device.findSerialPortChannel(address, function(channel){
//       console.log('Found RFCOMM channel for serial port on %s: ', name, channel);
//
//       // make bluetooth connect to remote device
//       Bluetooth.connect(address, channel, function(err, connection){
//         if(err) return console.error(err);
//
//         var stream = TwitterClient.stream('user');
//         stream.on('data', function(event) {
//
//           if (event.text = '@tweetnxt beep') {
//             connection.write(new Buffer([0x06, 0x00, 0x80, 0x03, 0x0B, 0x02, 0xF4, 0x01]));
//           }
//         });
//
//         stream.on('error', function(error) {
//           throw error;
//         });
//       });
//     });
//
//   }
// }).inquire();
