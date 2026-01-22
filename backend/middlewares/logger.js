const logger = (req, res, next) => {
    console.log("■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■");
    console.log(`${req.method} ${req.url}`);
    console.log("Query:", req.query);
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■");
    next();
};

module.exports = { logger };
