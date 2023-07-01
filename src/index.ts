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

const eventTicketStorage = new StableBTreeMap<string, EventTicket>(0, 44, 1024);

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
export function deleteUserProfile(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.remove(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(
        `couldn't delete ticket with id=${id}. Profile not found.`
      ),
  });
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
