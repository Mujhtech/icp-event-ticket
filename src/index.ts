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
  nat8,
  $init,
} from "azle";
import { v4 as uuidv4 } from "uuid";

//Record to store the details about the ticket
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

type EventTicketPayload = Record<{
  title: string;
  description: string;
  price: number;
}>;

//variable to store the principal ID of the contract admin
var eventAdmin : Principal;

//map to store all the tickets created
const eventTicketStorage = new StableBTreeMap<string, EventTicket>(0, 44, 1024);

//map to store all the sold tickets
const ticketSoldStorage = new StableBTreeMap<string, TicketSold>(0, 44, 1024);

//tacking the number of event organizers that have been added by the admin
let organizerCount : nat8 = 0;

//map to store the Principal IDs of the event organizers
const eventOrganizers = new StableBTreeMap<nat8,Principal>(1,100,1000);


//specify the admin of the contract on deployment
$init;
export function init(admin : string) : void{
  eventAdmin = Principal.fromText(admin);
}


//check if one is Admin or event organizer
$query;
export function isOrganizer( id : string) : boolean{
  const isorganizer = eventOrganizers.values().filter((organizer) => organizer.toString() === id);
  if(isorganizer.length > 0){
      return true;
  }else if(Principal.fromText(id) === eventAdmin){
      return true;
  }
  return false;
}


//add organizer by the admin
$update;
export function addOrganizer( org : string) : Result<string, string>{
  if(org.length !== 0 && isOrganizer(ic.caller().toString())){
    organizerCount = (organizerCount+1);
    eventOrganizers.insert(organizerCount,Principal.fromText(org));
    return Result.Ok<string,string>("New organizer added successfully");
  }
  return Result.Err<string,string>("Unable to add new Organizer");
}


//delete an organizer by an admin or fellow organizer
$update;
export function deleteOrganizer(id : nat8) : Result<string,string>{
  if(isOrganizer(ic.caller().toString())){
    return match(eventOrganizers.remove(id),{
      Some : () =>{ return Result.Ok<string,string>("Organizer deleted successfully")},
      None : ()=>{ return Result.Err<string,string>("organizer cannot be deleted")}
    });
  }
  return Result.Err<string,string>("You dont have permissions to delete an organizer")
}


//get all event tickets
$query;
export function getAllEventTickets(): Result<Vec<EventTicket>, string> {
  return Result.Ok(eventTicketStorage.values());
}

//create a ticket by the event organizer ot admin
$update;
export function createEventTicket(
  payload: EventTicketPayload
): Result<EventTicket, string> {

  const caller = ic.caller().toString();
  if(!isOrganizer(caller)){
    return Result.Err<EventTicket,string>("Only Event organizers or admins can create tickets");
  }

  const newTicket: EventTicket = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    ...payload,
    totalTicketSold: 0,
  };
  eventTicketStorage.insert(newTicket.id, newTicket);
  return Result.Ok(newTicket);
}


//retrieve event tickets by an id
$query;
export function getEventTicketById(id: string): Result<EventTicket, string> {
  return match(eventTicketStorage.get(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(`event ticket with id=${id} not found`),
  });
}


//delete a ticket by the event organizer
$update;
export function deleteEventTicket(id: string): Result<EventTicket, string> {
  const caller = ic.caller().toString();
  if(!isOrganizer(caller)){
    return Result.Err<EventTicket,string>("You are not authorized to delete tickets")
  }

  return match(eventTicketStorage.remove(id), {
    Some: (ticket) => Result.Ok<EventTicket, string>(ticket),
    None: () =>
      Result.Err<EventTicket, string>(
        `couldn't delete ticket with id=${id}. Profile not found.`
      ),
  });
}


//get a sold ticket by its id
$query;
export function getTicketSoldById(id: string): Result<TicketSold, string> {
  return match(ticketSoldStorage.get(id), {
    Some: (ticket) => Result.Ok<TicketSold, string>(ticket),
    None: () =>
      Result.Err<TicketSold, string>(`ticket sold with id=${id} not found`),
  });
}


//buy a ticket
$update;
export function buyTicket(
  id: string,
  username: string
): Result<TicketSold, string> {

  const caller = ic.caller().toString();

  if(isOrganizer(caller)){
    return Result.Err<TicketSold,string>("Event organizers cannot buy their own tickets");
  }
  const eventTicket = getEventTicketById(id);

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

  ticketSoldStorage.insert(newTicket.id, newTicket);

  const updateEventTicket = {
    ...ticket,
    totalTicketSold: ticket.totalTicketSold + 1,
    updatedAt: Opt.Some(ic.time()),
  };

  eventTicketStorage.insert(updateEventTicket.id, updateEventTicket);

  return Result.Ok<TicketSold, string>(newTicket);
}


//resell a ticket by its owner
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

  ticketSoldStorage.insert(newTicket.id, newTicket);

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
