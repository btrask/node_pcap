function lpad(str, len) {
    while (str.length < len) {
        str = "0" + str;
    }
    return str;
}

var unpack = {
    ethernet_addr: function (raw_packet, offset) {
        return [
            lpad(raw_packet[offset].toString(16), 2),
            lpad(raw_packet[offset + 1].toString(16), 2),
            lpad(raw_packet[offset + 2].toString(16), 2),
            lpad(raw_packet[offset + 3].toString(16), 2),
            lpad(raw_packet[offset + 4].toString(16), 2),
            lpad(raw_packet[offset + 5].toString(16), 2)
        ].join(":");
    },
    sll_addr: function (raw_packet, offset, len) {
        var res = [], i;
        for (i=0; i<len; i++){
            res.push(lpad(raw_packet[offset+i].toString(16), 2));
        }

        return res.join(":");
    },
    uint16: function (raw_packet, offset) {
        return ((raw_packet[offset] * 256) + raw_packet[offset + 1]);
    },
    uint16_be: function (raw_packet, offset) {
        return ((raw_packet[offset+1] * 256) + raw_packet[offset]);
    },
    uint32: function (raw_packet, offset) {
        return (
            (raw_packet[offset] * 16777216) +
            (raw_packet[offset + 1] * 65536) +
            (raw_packet[offset + 2] * 256) +
            raw_packet[offset + 3]
        ) >>> 0;
    },
    uint32_be: function (raw_packet, offset) {
        return (
            (raw_packet[offset + 3] << 24) +
            (raw_packet[offset + 2] << 16) +
            (raw_packet[offset + 1] << 8) +
            (raw_packet[offset + 0] << 0)
        ) >>> 0;
    },
    sint32_be: function (raw_packet, offset) {
        return (
            (raw_packet[offset + 3] << 24) +
            (raw_packet[offset + 2] << 16) +
            (raw_packet[offset + 1] << 8) +
            (raw_packet[offset + 0] << 0)
        );
    },
    uint64: function (raw_packet, offset) {
        return (
            (raw_packet[offset] * 72057594037927936) +
            (raw_packet[offset + 1] * 281474976710656) +
            (raw_packet[offset + 2] * 1099511627776) +
            (raw_packet[offset + 3] * 4294967296) +
            (raw_packet[offset + 4] * 16777216) +
            (raw_packet[offset + 5] * 65536) +
            (raw_packet[offset + 6] * 256) +
            raw_packet[offset + 7]
        );
    },
    ipv4_addr: function (raw_packet, offset) {
        return [
            raw_packet[offset],
            raw_packet[offset + 1],
            raw_packet[offset + 2],
            raw_packet[offset + 3]
        ].join('.');
    },
    ipv6_addr: function (raw_packet, offset) {
        var i;
        var ret = '';
        var octets = [];
        for (i=offset; i<offset+16; i+=2) {
            octets.push(unpack.uint16(raw_packet,i).toString(16));
        }
        var curr_start, curr_len;
        var max_start, max_len;
        for(i = 0; i < 8; i++){
            if(octets[i] == "0"){
                if(curr_start === undefined){
                    curr_len = 1;
                    curr_start = i;
                }else{
                    curr_len++;
                    if(!max_start || curr_len > max_len){
                        max_start = curr_start;
                        max_len = curr_len;
                    }
                }
            }else{
                curr_start = undefined;
            }
        }

        if(max_start !== undefined){
            var tosplice = max_start === 0 || (max_start + max_len > 7) ? ":" : "";
            octets.splice(max_start, max_len,tosplice);
            if(max_len == 8){octets.push("");}
        }
        ret = octets.join(":");
        return ret;
    },
    hex: function (raw_packet, offset, length, be) {
        var bytes = [], i;
        for (i=offset; i<offset+length; ++i) {
            bytes.push(("0"+raw_packet[i].toString(16)).slice(-2));
        }
        if(be) bytes.reverse();
        return "0x"+bytes.join("");
    },
};
module.exports = unpack;
