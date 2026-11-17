export const inquiryMinLength = 5;
export const inquiryMaxLength = 2000;
export type FaqInquiry = {id:string;question:string;senderName:string|null;createdAt:number;readAt:number|null};
export type FaqInbox = {inquiries:FaqInquiry[];total:number;unread:number;page:number;pages:number};
