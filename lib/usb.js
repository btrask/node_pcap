/* Copyright (c) 2013 Ben Trask

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE. */
var usb = exports;
var unpack = require("./unpack");

var urb = {};
usb.urb = urb;

// TODO - LINKTYPE_USB_LINUX_MMAPPED is assumed.

usb.decode = function (raw_packet, offset, type) {
	var ret = {};

	// URB

	ret.urb_id = unpack.hex(raw_packet, offset + 0x00, 8, true); // 0x00-0x07
	ret.urb_type = String.fromCharCode(raw_packet[offset + 0x08]);
	ret.urb_transfer_type = raw_packet[offset + 0x09];
	ret.endpoint = {}; // 0x0a
	ret.endpoint.direction = raw_packet[offset + 0x0a] >>> 7;
	ret.endpoint.value = raw_packet[offset + 0x0a] & 0x7f;

	ret.device = raw_packet[offset + 0x0b];
	ret.bus_id = unpack.uint16_be(raw_packet, offset + 0x0c); // 0x0c, 0x0d
	ret.device_setup_request = String.fromCharCode(raw_packet[offset + 0x0e]);
	ret.data = raw_packet[offset + 0x0f];
	ret.urb_sec = unpack.hex(raw_packet, offset + 0x10, 8, true); // 0x10-0x17
	ret.urb_usec = unpack.uint32_be(raw_packet, offset + 0x18); // 0x18-0x1b
	ret.urb_status = unpack.sint32_be(raw_packet, offset + 0x1c, 4, true); // 0x1c-1f
	ret.urb_length = unpack.uint32_be(raw_packet, offset + 0x20); // 0x20-0x23
	ret.data_length = unpack.uint32_be(raw_packet, offset + 0x24); // 0x24-0x27

	if(urb.device_setup_requests.relevant === ret.device_setup_request) {

		ret.setup = {}; // URB setup 0x28-0x2f

		ret.setup.bmRequestType = {}; // 0x28
		ret.setup.bmRequestType.direction = raw_packet[offset + 0x28] >>> 7 & 0x01;
		ret.setup.bmRequestType.type = raw_packet[offset + 0x28] >>> 5 & 0x03;
		ret.setup.bmRequestType.recipient = raw_packet[offset + 0x28] & 0x1f;

		var bRequest = raw_packet[offset + 0x29];
		var wLength = unpack.uint16_be(raw_packet, offset + 0x2e); // 0x2e, 0x2f

		switch(ret.setup.bmRequestType.type) {
			case urb.setup_request_types.Standard:
				ret.setup.standard = {};
				ret.setup.standard.bRequest = bRequest;
				switch(bRequest) {
					case urb.setup_requests.GET_DESCRIPTOR:
						ret.setup.standard.descriptor = {};
						ret.setup.standard.descriptor.index = raw_packet[offset + 0x2a];
						ret.setup.standard.descriptor.type = raw_packet[offset + 0x2b];
						ret.setup.standard.descriptor.language_id = unpack.uint16_be(raw_packet, offset + 0x2c); // 0x2c, 0x2d
						break;
					case urb.setup_requests.SET_INTERFACE:
						ret.setup.standard.interface = {};
						ret.setup.standard.interface.bAlternateSetting = raw_packet[offset + 0x2a];
						ret.setup.standard.interface.wInterface = unpack.uint16_be(raw_packet, offset + 0x2b); // 0x2c, 0x2d
						ret.setup.standard.interface.wLength = unpack.uint16_be(raw_packet, offset + 0x2d); // 0x2e, 0x2f
						break;
					default:
						// TODO - more parsing.
						break;
				}
				ret.setup.standard.wLength = wLength;
				break;
			case urb.setup_request_types.Class:
				ret.setup.class = {};
				ret.setup.class.bRequest = bRequest;
				ret.setup.class.wLength = wLength;
				break;
			case urb.setup_request_types.Vendor:
				ret.setup.vendor = {};
				ret.setup.vendor.bRequest = bRequest;
				ret.setup.vendor.wValue = unpack.uint16_be(raw_packet, offset + 0x2a); // 0x2a, 0x2b
				ret.setup.vendor.wIndex = unpack.uint16_be(raw_packet, offset + 0x2c); // 0x2c, 0x2d
				ret.setup.vendor.wLength = wLength;
				break;
			default:
				ret.setup.UNKNOWN_TYPE = ret.setup.bmRequestType.type;
				break;
		}

	} // URB setup

	return ret;
};

usb.print = function(packet, type) {
	var fields = [];

	fields.push("Device "+packet.link.device);
	delete packet.link.device;

	fields.push(lookup(urb.transfer_type_codes, packet.link.urb_transfer_type));
	delete packet.link.urb_transfer_type;
	fields.push(lookup(urb.endpoint_direction_codes, packet.link.endpoint.direction));
	delete packet.link.endpoint;
	fields.push(lookup(urb.type_codes, packet.link.urb_type));
	delete packet.link.urb_type;

	if(packet.link.setup) {
		var setup = [];
		setup.push(lookup(urb.setup_request_direction_codes, packet.link.setup.bmRequestType.direction));
		setup.push(lookup(urb.setup_request_type_codes, packet.link.setup.bmRequestType.type));
		setup.push(lookup(urb.setup_request_recipient_codes, packet.link.setup.bmRequestType.recipient));
		delete packet.link.setup.bmRequestType;
		if(packet.link.setup.standard) {
			setup.push(lookup(urb.setup_request_codes, packet.link.setup.standard.bRequest));
			delete packet.link.setup.standard.bRequest;
			if(!props(packet.link.setup.standard)) delete packet.link.setup.standard;
		}
		if(packet.link.setup.class) {
			setup.push(packet.link.setup.class.bRequest);
			delete packet.link.setup.class.bRequest;
			if(!props(packet.link.setup.class)) delete packet.link.setup.class;
		}
		if(packet.link.setup.vendor) {
			setup.push(packet.link.setup.vendor.bRequest);
			delete packet.link.setup.vendor.bRequest;
			setup.push("0x"+("000"+packet.link.setup.vendor.wIndex.toString(16)).slice(-4));
			delete packet.link.setup.vendor.wIndex;
			setup.push("0x"+("000"+packet.link.setup.vendor.wValue.toString(16)).slice(-4));
			delete packet.link.setup.vendor.wValue;
			if(!props(packet.link.setup.vendor)) delete packet.link.setup.vendor;
		}
		fields.push("["+setup.join(", ")+"]");

		if(!props(packet.link.setup)) delete packet.link.setup;
	}

	// Fields no one cares about
	delete packet.link.urb_id;
	delete packet.link.urb_sec;
	delete packet.link.urb_usec;
	delete packet.link.urb_status;
	delete packet.link.bus_id;

	if(has(urb.device_setup_request_codes, packet.link.device_setup_request))
		delete packet.link.device_setup_request;

	if(props(packet.link)) fields.push(JSON.stringify(packet.link));

	return fields.join(", ");
};

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}
function props(obj) {
	return Object.keys(obj).length;
}
function lookup(obj, prop) {
	return has(obj, prop) ? obj[prop] : "Unknown value "+prop;
}
function swap(obj) {
	var ret = {};
	for(var prop in obj) if(has(obj, prop)) ret[obj[prop]] = prop;
	return ret;
}

urb.types = {
	"URB_SUBMIT": 'S',
	"URB_COMPLETE": 'C',
	"URB_ERROR": 'E',
};
urb.type_codes = swap(urb.types);

urb.transfer_types = {
	"URB_ISOCHRONOUS": 0,
	"URB_INTERRUPT": 1,
	"URB_CONTROL": 2,
	"URB_BULK": 3,
};
urb.transfer_type_codes = swap(urb.transfer_types);

urb.endpoint_directions = {
	"OUT": 0,
	"IN": 1,
};
urb.endpoint_direction_codes = swap(urb.endpoint_directions);

urb.device_setup_requests = {
	"relevant": "\0",
	"not_relevant": "-",
};
urb.device_setup_request_codes = swap(urb.device_setup_requests);

urb.statuses = {
	"ENOERR": 0,
	"EINPROGRESS": -115,
};
urb.status_codes = swap(urb.statuses);

urb.setup_request_directions = {
	"Host-to-device": 0,
	"Device-to-host": 1,
};
urb.setup_request_direction_codes = swap(urb.setup_request_directions);

urb.setup_request_types = {
	"Standard": 0,
	"Class": 1,
	"Vendor": 2,
	"Reserved": 3,
};
urb.setup_request_type_codes = swap(urb.setup_request_types);

urb.setup_request_recipients = {
	"Device": 0,
	"Interface": 1,
	"Endpoint": 2,
	"Other": 3,
	"Reserved4": 4,
	"Reserved5": 5,
	"Reserved6": 6,
	"Reserved7": 7,
	"Reserved8": 8,
	"Reserved9": 9,
	"Reserved10": 10,
	"Reserved11": 11,
	"Reserved12": 12,
	"Reserved13": 13,
	"Reserved14": 14,
	"Reserved15": 15,
	"Reserved16": 16,
	"Reserved17": 17,
	"Reserved18": 18,
	"Reserved19": 19,
	"Reserved20": 20,
	"Reserved21": 21,
	"Reserved22": 22,
	"Reserved23": 23,
	"Reserved24": 24,
	"Reserved25": 25,
	"Reserved26": 26,
	"Reserved27": 27,
	"Reserved28": 28,
	"Reserved29": 29,
	"Reserved30": 30,
	"Reserved31": 31,
};
urb.setup_request_recipient_codes = swap(urb.setup_request_recipients);

urb.setup_requests = {
	"GET_STATUS": 0,
	"CLEAR_FEATURE": 1,
	"RESERVED_2": 2,
	"SET_FEATURE": 3,
	"RESERVED_4": 4,
	"SET_ADDRESS": 5,
	"GET_DESCRIPTOR": 6,
	"SET_DESCRIPTOR": 7,
	"GET_CONFIGURATION": 8,
	"SET_CONFIGURATION": 9,
	"GET_INTERFACE": 10,
	"SET_INTERFACE": 11,
	"SYNCH_FRAME": 12,
};
urb.setup_request_codes = swap(urb.setup_requests);
