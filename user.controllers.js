//import express-async-handler to handle asynchronous errors
const expressasynchandler = require("express-async-handler");

//import bcryptjs
const bcrypt = require("bcryptjs");

//import jsonwebtoken
const jwt = require("jsonwebtoken");

//configure dotenv to read environment variables
require("dotenv").config();

//import Employee,User model
const { User } = require("../db/models/User.model");
//import Controller from admin
const { PotfolioDashboard } = require("./admin.controllers");

//import sequelize from db.config
const { sequelize } = require("../db/db.config");
const { Project } = require("../db/models/project.model");

//----------------Nodemailer--------------------------//
//import nodemailer
const nodemailer = require("nodemailer");
//create connectio to SMTP
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE_PROVIDER,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

//creating otps
let otps = {};

//-------------------------------------------Registration-------------------------------------//
exports.registeration = expressasynchandler(async (req, res) => {
  //Extract fields from request body
  let { employeeName, email, password } = req.body;
  //check if user exists in employee table
  // console.log(req.body.username)
  let [emp] = await sequelize.query(
    `select * from employees where email="${email}"`
  );

  console.log("emp", emp);
  if (emp.length == 0) {
    res.send({ message: "Only employees can register" });
  } else {
    //check if user already registered
    let user = await User.findOne({ where: { email: email } });
    // console.log(user)
    //if user already registered
    if (user !== null) {
      res.send({ message: "user already registered" });
    }
    //if user did not register
    else {
      req.body.email = req.body.email.toLowerCase();
      req.body.password = await bcrypt.hash(req.body.password, 5);
      await User.create(req.body);
      res.status(201).send({ message: "User registered" });
    }
  }
});
//get the role of employee
// let employee = await Employee.findOne({ where: { email: email } });
// if (employee) {
//   let role = employee.dataValues.role;
//   //check the role of employee
//   if (
//     role == "adminUser" ||
//     role == "gdoHead" ||
//     role == "projectManager" ||
//     role == "superAdmin" ||
//     role == "hrManager"
//   ) {
//     //Check email domain
//     if (
//       /^([A-Za-z0-9_\.])+\@(westagilelabs|WESTAGILELABS)+\.(com)$/.test(email)
//     ) {
//       //Hash the password
//       password = await bcrypt.hash(password, 5);

//       //adding employee details to database
//       let employee = await Employee.update(
//         { password: password },
//         { where: { email: email } }
//       );

//       //sending employee details for conformation
//       res.status(201).send({
//         message: "Employee Regitered",
//         payload: employee.dataValues,
//       });
//     }
//     //Not Valid Gmail id
//     else {
//       res.send({ message: "Register with the Organisation Email Only" });
//     }
//   }
// } else {
//   res.status(404).send({ message: "Employee Details not Found" });
// }

//-------------------------------------------Login-------------------------------------//
exports.login = expressasynchandler(async (req, res) => {
  //extract requset body
  let { email, password } = req.body;
  email = email.toLowerCase();

  //check email is organization email or not
  if (!/^([A-Za-z0-9_\.])+\@(westagilelabs)+\.(com)$/.test(email)) {
    res.send({
      message: "Only Organization Emails required ,Others Not Allowed",
    });
  }
  //Organization Email
  else {
    //check email exists or not
    let user = await User.findOne({ where: { email: email } });
    if (user) {
      //check Password

      let result = await bcrypt.compare(password, user.dataValues.password);
      if (result) {
        //check Role
        let role = user.dataValues.role;
        // console.log("-------------------------", role);
        if (
          role == "adminUser" ||
          role == "gdoHead" ||
          role == "projectManager" ||
          role == "superAdmin" ||
          role == "hrManager"
        ) {
          //generate jwt token
          let signedToken = jwt.sign({}, process.env.SECRET_KEY, {
            expiresIn: "2d",
          });
          signedToken = signedToken.concat(" .").concat(role);
          //if role is admin user ,send all the project details
          delete user.dataValues.password;
          res.send({
            message: "Success",
            token: signedToken,
            user: user.dataValues,
          });
        }

        //Other Role
        else {
          res.send({
            message:
              "Only Special Users Has Access, Contact Super Admin for more info",
          });
        }
      } else {
        res.send({ message: "Invalid Password" });
      }
    }
    //user not in Users
    else {
      res.send({ message: "User Not Registered" });
    }
  }
});
//-------------------------------------------FORGOT PASSWORD-------------------------------------//
exports.forgotPassword = expressasynchandler(async (req, res) => {
  //generate6 digits OTP
  let otp = Math.floor(Math.random() * (999999 - 199999)) + 100000;
  //Add otp to otps{}
  otps[req.body.email] = otp;
  console.log(otps);
  //Write The Mail
  let mailOptions = {
    from: process.env.EMAIL,
    to: req.body.email,
    subject: "OTP TO RESET YOUR PASSWORD",
    text:
      "Hey ,We Received a request To CHANGE THE PASSWORD,If it is done by you,Please enter the following otp to Reset Your Password" +
      otp,
  };
  //Sending The Mail
  transporter.sendMail(mailOptions, function (err, info) {
    //Error Occurred
    if (err) {
      console.log("------ERROR-----", err);
    }
    //If no Error
    else {
      res.status(200).send({ message: "Mail Sent " + info.response });
    }
  });
  //Expire Time To OTP
  setTimeout(() => {
    delete otps[req.body.email];
  }, 6000000);
});

//-------------------------------------------RESET PASSWORD-------------------------------------//
exports.resetPassword = expressasynchandler(async (req, res) => {
  //Check OTP
  if (req.body.otp == otps[req.body.email]) {
    console.log("-------OTP VERIFIED-----");
    //Hash Th Password
    let hashedPassword = await bcrypt.hash(req.body.password, 5);

    let [updated] = await User.update(
      { password: hashedPassword },
      { where: { email: req.body.email } }
    );

    console.log(updated);
    if (updated) {
      res.send({ message: "Password Updated" });
    }
  } else {
    res.status(408).send({ message: "Invalid OTP" });
  }
});

//-------------------------------------------Role Mapping-------------------------------------//
exports.roleMapping = expressasynchandler(async (req, res) => {
  let { email, role } = req.body;
  let employee = await User.findOne({ where: { email: email } });

  //if employee exists assign role
  if (employee) {
    let [updatedCount] = await User.update(
      { role: role },
      { where: { email: email } }
    );

    if (updatedCount != 0) {
      res.status(200).send({
        message: "Role Mapped Successfully",
        payload: [email, role],
      });
    } else {
      res.send({
        message:
          "You have selected the Role which is already mapped to this employee",
      });
    }
  } else {
    res.status(404).send({ message: "Please Register the User" });
  }
});
//------------------------------------------Remove Role-------------------------------------//
exports.deleteRole = expressasynchandler(async (req, res) => {
  //run the query
  let [updatedCount] = await User.update(
    { role: "" },
    { where: { email: req.params.user } }
  );
  console.group(updatedCount);
  if (updatedCount) {
    res.send({ message: "Removed the role" });
  } else {
    res.send({ message: "Currently No role is mapped to this employee" });
  }
});

//------------------------------------------Get All Users-------------------------------------//
exports.getUsers = expressasynchandler(async (req, res) => {
  //get all users
  let users = await User.findAll({
    attributes: {
      exclude: ["password"],
    },
  });
  users = users.map((userObj) => userObj.dataValues);
  console.log("users---", users);
  res.status(200).send({ message: "All User Details", payload: users });
});
