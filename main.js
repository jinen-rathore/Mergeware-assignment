import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { Mongo } from "meteor/mongo";
import { check } from "meteor/check";

// Define collections
export const Loans = new Mongo.Collection("loans");
export const Payments = new Mongo.Collection("payments");

// Define schema for loans collection
const LoansSchema = new SimpleSchema({
  userId: { type: String },
  amount: { type: Number },
  status: {
    type: String,
    allowedValues: ["requested", "approved", "paid", "rejected"],
  },
});

Loans.attachSchema(LoansSchema);

// Define schema for payments collection
const PaymentsSchema = new SimpleSchema({
  loanId: { type: String },
  userId: { type: String },
  amount: { type: Number },
});

Payments.attachSchema(PaymentsSchema);

Meteor.startup(() => {
  // Create default admin user if not exists
  if (!Meteor.users.findOne({ username: "admin" })) {
    const adminUserId = Accounts.createUser({
      username: "admin",
      password: "admin123",
    });
    Meteor.users.update(adminUserId, { $set: { roles: ["admin"] } });
  }
});

// Publications
Meteor.publish("loans", function () {
  if (Roles.userIsInRole(this.userId, "admin")) {
    return Loans.find();
  } else {
    return Loans.find({ userId: this.userId });
  }
});

Meteor.publish("payments", function () {
  return Payments.find({ userId: this.userId });
});

// Methods
Meteor.methods({
  "loans.request"(amount) {
    check(amount, Number);
    if (!this.userId) {
      throw new Meteor.Error("not-authorized");
    }

    Loans.insert({
      userId: this.userId,
      amount,
      status: "requested",
    });
  },

  "loans.approve"(loanId) {
    check(loanId, String);
    if (!this.userId || !Roles.userIsInRole(this.userId, "lender")) {
      throw new Meteor.Error("not-authorized");
    }

    Loans.update(loanId, { $set: { status: "approved" } });
  },

  "loans.reject"(loanId) {
    check(loanId, String);
    if (!this.userId || !Roles.userIsInRole(this.userId, "lender")) {
      throw new Meteor.Error("not-authorized");
    }

    Loans.update(loanId, { $set: { status: "rejected" } });
  },

  "loans.pay"(loanId, amount) {
    check(loanId, String);
    check(amount, Number);
    if (!this.userId || !Roles.userIsInRole(this.userId, "lender")) {
      throw new Meteor.Error("not-authorized");
    }

    const loan = Loans.findOne(loanId);
    if (!loan || loan.status !== "approved") {
      throw new Meteor.Error("invalid-operation", "Loan not approved");
    }

    Payments.insert({
      loanId,
      userId: this.userId,
      amount,
    });

    Loans.update(loanId, { $set: { status: "paid" } });
  },
});

// Server-side user account creation method
Meteor.methods({
  "users.register"(email, password, roles) {
    check(email, String);
    check(password, String);
    check(roles, [String]);

    const userId = Accounts.createUser({
      email,
      password,
    });

    Roles.addUsersToRoles(userId, roles);

    return userId;
  },
});
