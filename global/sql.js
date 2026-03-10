const useWindowsAuth = process.env.DB_WINDOWS_AUTH === "true";

const sql = useWindowsAuth
    ? require("mssql/msnodesqlv8")
    : require("mssql");

module.exports = sql;
