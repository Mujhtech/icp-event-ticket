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
} from "azle";
import { v4 as uuidv4 } from "uuid";

type EventTicket = Record<{
  id: string;
  title: string;
  description: string;
  price: number;
  totalTicketSold: number;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type TicketSold = Record<{
  id: string;
  eventTicketId: string;
  username: string;
}>;

const eventTicketStorage = new StableBTreeMap<string, EventTicket>(0, 44, 1024);

const ticketStorage = new StableBTreeMap<string, TicketSold>(0, 44, 1024);

$query;
export function getAllEventTickets(): Result<Vec<EventTicket>, string> {
  return Result.Ok(eventTicketStorage.values());
}

$query;
export function getTicketById(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.get(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(`event ticket with id=${id} not found`),
  });
}

$update;
export function deleteEventTicket(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.remove(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(
        `couldn't delete ticket with id=${id}. Profile not found.`
      ),
  });
}

$query;
export function getTicketSoldById(id: string): Result<TicketSold, string> {
  return match(ticketStorage.get(id), {
    Some: (ticket) => Result.Ok<TicketSold, string>(ticket),
    None: () =>
      Result.Err<TicketSold, string>(`ticket sold with id=${id} not found`),
  });
}

$update;
export function buyTicket(
  id: string,
  username: string
): Result<TicketSold, string> {
  const eventTicket = getTicketById(id);

  if (eventTicket.isErr()) {
    return Result.Err<EventTicket, string>(
      `Event ticket with id=${id} not found.`
    );
  }

  const ticket = eventTicket.unwrap();

  const newTicket = {
    id: uuidv4(),
    eventTicketId: ticket.id,
    username: username,
  };

  ticketStorage.insert(newTicket.id, newTicket);

  return Result.Ok<TicketSold, string>(newTicket);
}

$update;
export function resellTIcket(
  id: string,
  username: string
): Result<TicketSold, string> {
  const ticket = getTicketSoldById(id);

  if (ticket.isErr()) {
    return Result.Err<EventTicket, string>(
      `ticket sold with id=${id} not found.`
    );
  }

  const newTicket = {
    ...ticket.unwrap(),
    username: username,
  };

  ticketStorage.insert(newTicket.id, newTicket);

  return Result.Ok<TicketSold, string>(newTicket);
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
