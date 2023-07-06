import { $query, $update, StableBTreeMap, match, Result, ic, Opt, } from "azle";
import { v4 as uuidv4 } from "uuid";
const eventTicketStorage = new StableBTreeMap(0, 44, 1024);
const ticketSoldStorage = new StableBTreeMap(0, 44, 1024);
$query;
export function getAllEventTickets() {
    return Result.Ok(eventTicketStorage.values());
}
$update;
export function createEventTicket(payload) {
    const newTicket = {
        id: uuidv4(),
        createdAt: ic.time(),
        updatedAt: Opt.None,
        ...payload,
        totalTicketSold: 0,
    };
    eventTicketStorage.insert(newTicket.id, newTicket);
    return Result.Ok(newTicket);
}
$query;
export function getEventTicketById(id) {
    return match(eventTicketStorage.get(id), {
        Some: (ticket) => Result.Ok(ticket),
        None: () => Result.Err(`event ticket with id=${id} not found`),
    });
}
$update;
export function deleteEventTicket(id) {
    return match(eventTicketStorage.remove(id), {
        Some: (ticket) => Result.Ok(ticket),
        None: () => Result.Err(`couldn't delete ticket with id=${id}. Profile not found.`),
    });
}
$query;
export function getTicketSoldById(id) {
    return match(ticketSoldStorage.get(id), {
        Some: (ticket) => Result.Ok(ticket),
        None: () => Result.Err(`ticket sold with id=${id} not found`),
    });
}
$update;
export function buyTicket(id, username) {
    const eventTicket = getEventTicketById(id);
    if (eventTicket.isErr()) {
        return Result.Err(`Event ticket with id=${id} not found.`);
    }
    const ticket = eventTicket.unwrap();
    const newTicket = {
        id: uuidv4(),
        eventTicketId: ticket.id,
        username: username,
    };
    ticketSoldStorage.insert(newTicket.id, newTicket);
    const updateEventTicket = {
        ...ticket,
        totalTicketSold: ticket.totalTicketSold + 1,
        updatedAt: Opt.Some(ic.time()),
    };
    eventTicketStorage.insert(updateEventTicket.id, updateEventTicket);
    return Result.Ok(newTicket);
}
$update;
export function resellTIcket(id, username) {
    const ticket = getTicketSoldById(id);
    if (ticket.isErr()) {
        return Result.Err(`ticket sold with id=${id} not found.`);
    }
    const newTicket = {
        ...ticket.unwrap(),
        username: username,
    };
    ticketSoldStorage.insert(newTicket.id, newTicket);
    return Result.Ok(newTicket);
}
// a workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },
};
