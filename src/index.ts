import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type EventTicket = Record<{
  id: string;
  owner: Principal;
  title: string;
  description: string;
  price: number;
  totalTicketSold: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type TicketSold = Record<{
  id: string;
  owner: Principal;
  eventTicketId: string;
  username: string;
}>;

type EventTicketPayload = Record<{
  title: string;
  description: string;
  price: number;
}>;

const eventTicketStorage = new StableBTreeMap<string, EventTicket>(0, 44, 1024);

const ticketSoldStorage = new StableBTreeMap<string, TicketSold>(1, 44, 1024);

// Function to fetch all EventTickets
$query;
export function getAllEventTickets(): Result<Vec<EventTicket>, string> {
  return Result.Ok(eventTicketStorage.values());
}

// Function to create an EventTicket
$update;
export function createEventTicket(
  payload: EventTicketPayload
): Result<EventTicket, string> {
  const newTicket: EventTicket = {
    id: uuidv4(),
    owner: ic.caller(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    ...payload,
    totalTicketSold: 0,
  };
  eventTicketStorage.insert(newTicket.id, newTicket);
  return Result.Ok(newTicket);
}

// Function to fetch a specific EventTicket with the specified id
$query;
export function getEventTicketById(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.get(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(`event ticket with id=${id} not found`),
  });
}

// Function to delete an EventTicket
// EventTickets can only be removed by their owners
$update;
export function deleteEventTicket(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.get(id), {
    Some: (ticket) => {
      // return an error if caller isn't the EventTicket's owner
      if (ticket.owner.toString() !== ic.caller().toString()) {
        return Result.Err<EventTicket, string>("Unauthorized caller");
      }
      // remove EventTicket from storage
      eventTicketStorage.remove(id);
      return Result.Ok<EventTicket, string>(ticket);
    },
    None: () =>
      Result.Err<EventTicket, string>(
        `couldn't delete ticket with id=${id}. Profile not found.`
      ),
  });
}

// Function to fetch a TicketSold with the specified id
$query;
export function getTicketSoldById(id: string): Result<TicketSold, string> {
  return match(ticketSoldStorage.get(id), {
    Some: (ticket) => Result.Ok<TicketSold, string>(ticket),
    None: () =>
      Result.Err<TicketSold, string>(`ticket sold with id=${id} not found`),
  });
}

// Function to buy and create a TicketSold for an EventTicket
$update;
export function buyTicket(
  id: string,
  username: string
): Result<TicketSold, string> {
  const eventTicket = getEventTicketById(id);

  // checks if EventTicket with id exists
  if (eventTicket.Ok) {
    const ticket = eventTicket.Ok;

    const newTicket = {
      id: uuidv4(),
      owner: ic.caller(),
      eventTicketId: ticket.id,
      username: username,
    };

    // save TicketSold to storage
    ticketSoldStorage.insert(newTicket.id, newTicket);

    const updateEventTicket = {
      ...ticket,
      totalTicketSold: ticket.totalTicketSold + 1,
      updatedAt: Opt.Some(ic.time()),
    };
    // save updated EventTicket to storage
    eventTicketStorage.insert(updateEventTicket.id, updateEventTicket);

    return Result.Ok<TicketSold, string>(newTicket);
  }
  // return an error if TicketSold doesn't exist
  return Result.Err<TicketSold, string>(eventTicket.Err);
}

// Function to resell a TicketSold of an EventTicket to another user
$update;
export function resellTicket(
  id: string,
  username: string,
  newOwner: Principal
): Result<TicketSold, string> {
  const ticket = getTicketSoldById(id);

  // checks if TicketSold exists
  if (ticket.Ok) {
    // return an error if caller isn't the owner
    if (ticket.Ok.owner.toString() !== ic.caller().toString()) {
      return Result.Err<TicketSold, string>("Unauthorized caller");
    }
    const newTicket = {
      ...ticket.Ok,
      username: username,
      owner: newOwner,
    };

    // save updated TicketSold to storage
    ticketSoldStorage.insert(newTicket.id, newTicket);

    return Result.Ok<TicketSold, string>(newTicket);
  }
  return Result.Err<TicketSold, string>(ticket.Err);
}

$query;
export function checkTicketAvailability(id: string): Result<boolean, string> {
  const eventTicket = getEventTicketById(id);
  
  if (eventTicket.isErr()) {
    return Result.Err<boolean, string>(
      `Event ticket with id=${id} not found.`
    );
  }
  
  const ticket = eventTicket.unwrap();
  const availableTickets = ticket.totalTicketSold < ticket.capacity;
  
  return Result.Ok<boolean, string>(availableTickets);
}

$update;
export function reserveTicket(id: string, username: string): Result<string, string> {
  const eventTicket = getEventTicketById(id);
  
  if (eventTicket.isErr()) {
    return Result.Err<string, string>(
      `Event ticket with id=${id} not found.`
    );
  }
  
  const ticket = eventTicket.unwrap();
  
  if (ticket.reservedBy && ticket.reservedBy !== username) {
    return Result.Err<string, string>(`Ticket is already reserved by another user.`);
  }
  
  const updatedTicket = {
    ...ticket,
    reservedBy: username,
  };
  
  eventTicketStorage.insert(updatedTicket.id, updatedTicket);
  
  return Result.Ok<string, string>(updatedTicket.id);
}

$update;
export function transferTicket(id: string, newOwner: string): Result<string, string> {
  const ticket = getTicketSoldById(id);
  
  if (ticket.isErr()) {
    return Result.Err<string, string>(
      `Ticket sold with id=${id} not found.`
    );
  }
  
  const updatedTicket = {
    ...ticket.unwrap(),
    username: newOwner,
  };
  
  ticketSoldStorage.insert(updatedTicket.id, updatedTicket);
  
  return Result.Ok<string, string>(updatedTicket.id);
}

$update;
export function requestTicketRefund(id: string): Result<string, string> {
  const ticket = getTicketSoldById(id);
  
  if (ticket.isErr()) {
    return Result.Err<string, string>(
      `Ticket sold with id=${id} not found.`
    );
  }
  
  ticketSoldStorage.remove(id);
  
  return Result.Ok<string, string>(id);
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
