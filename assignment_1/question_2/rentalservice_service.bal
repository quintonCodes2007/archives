import ballerina/grpc;

listener grpc:Listener ep = new (9090);

@grpc:Descriptor {value: RENTAL_DESC}
service "RentalService" on ep {

    map<Property> properties = {};
    int propertyCounter = 1;

    function generatePropertyId(string propertyName, string location) returns string {
    string nameCode = propertyName.toUpperAscii();
    string locationCode = location.toUpperAscii();

    regexp:RegExp spaceRegex = re `\s+`;
    nameCode = spaceRegex.replaceAll(nameCode, "");
    locationCode = spaceRegex.replaceAll(locationCode, "");

    if nameCode.length() > 3 {
        nameCode = nameCode.substring(0, 3);
    }

    if locationCode.length() > 3 {
        locationCode = locationCode.substring(0, 3);
    }

    int count = 1;

    foreach Property property in properties {
        if property.property_name.toUpperAscii() == propertyName.toUpperAscii()
            && property.location.toUpperAscii() == location.toUpperAscii() {
            count += 1;
        }
    }

    string number = count.toString();

    while number.length() < 3 {
        number = "0" + number;
    }

    return nameCode + "-" + locationCode + "-" + number;
}

    remote function add_property(AddPropertyRequest value) returns AddPropertyResponse|error {
    }

    remote function update_property(UpdatePropertyRequest value) returns UpdatePropertyResponse|error {
    }

    remote function remove_property(RemovePropertyRequest value) returns RemovePropertyResponse|error {
    }

    remote function search_property(SearchPropertyRequest value) returns SearchPropertyResponse|error {
    }

    remote function book_property(BookPropertyRequest value) returns BookPropertyResponse|error {
    }

    remote function confirm_booking(ConfirmBookingRequest value) returns ConfirmBookingResponse|error {
    }

    remote function cancel_booking(CancelBookingRequest value) returns CancelBookingResponse|error {
    }

    remote function create_users(stream<CreateUserRequest, grpc:Error?> clientStream) returns CreateUsersResponse|error {
    }

    remote function list_available_properties(ListPropertiesRequest value) returns stream<Property, error?>|error {
    }

    remote function list_host_properties(ListHostPropertiesRequest value) returns stream<Property, error?>|error {
    }

    remote function view_my_bookings(ViewMyBookingsRequest value) returns stream<Booking, error?>|error {
    }
}
