import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import dayjs from "dayjs";
import 'dayjs/locale/zh-CN'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .on('languageChanged', (lng) => {
    dayjs.locale(lng);
  })
  .init({
    debug: true,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      caches: ['localStorage', 'sessionStorage', 'cookie'],
    },
    resources: {
      en: {
        translation: {
          // common
          cancel: "Cancel",
          delete: "Delete",
          reset: "Reset",
          createUser: "Create User",
          username: "Username",
          expires: "Expires {{time}}",
          expired: "Expired {{time}}",
          dateFormat: "MMMM d, yyy",

          // Login
          "login.password": "Password",
          "login.login": "Login",
          "login.loginYourAccount": 'Login to your account',
          "login.welcomeBack": 'Welcome back, please enter your details',

          // Header
          "header.hostsSetting": "Hosts Settings",
          "header.donation": "Donation",
          "header.logout": "Log out",

          // DeleteUserModal
          "deleteUser.title": "Delete User",
          "deleteUser.prompt": "Are you sure you want to delete <b>{{username}}</b>?",
          "deleteUser.deleteSuccess": "{{username}} deleted successfully.",

          // UsersTable
          "usersTable.status": "status",
          "usersTable.dataUsage": "dataUsage",
          "usersTable.noUserMatched": "It seems there is no user matched with what you are looking for",
          "usersTable.noUser": "There is no user added to the system",
          "usersTable.copyLink": "Copy Subscription Link",
          "usersTable.copied": "Copied",
          "usersTable.copyConfigs": "Copy Configs",

          // UserDialog
          "userDialog.dataLimit": "Data Limit",
          "userDialog.periodicUsageReset": "Periodic Usage Reset",
          "userDialog.warningNoProtocol": "Please select at least one protocol",
          "userDialog.expiryDate": "Expiry Date",
          "userDialog.resetUsage": "Reset Usage",
          "userDialog.protocols": "Protocols",
          "userDialog.editUserTitle": "Edit user",
          "userDialog.editUser": "Edit user",
          "userDialog.userEdited": "User {{username}} edited.",
          "userDialog.userCreated": "User {{username}} created.",
          "userDialog.userAlreadyExists": "User already exists",
          "userDialog.vmessDesc": "Fast and secure",
          "userDialog.vlessDesc": "Lightweight, fast and secure",
          "userDialog.trojanDesc": "Lightweight, secure and lightening fast",
          "userDialog.shadowsocksDesc": "Fast and secure, but not efficient as others",
          "userDialog.resetStrategyNo": "No",
          "userDialog.resetStrategyDaily": "Daily",
          "userDialog.resetStrategyWeekly": "Weekly",
          "userDialog.resetStrategyMonthly": "Monthly",
          "userDialog.resetStrategyAnnually": "Annually",

          // HostsDialog
          "hostsDialog.title": "Using this setting, you are able to assign specific address for each inbound.",
          "hostsDialog.desc": "Use these variables to make it dynamic",
          "hostsDialog.username": "the username of the user",
          "hostsDialog.dataUsage": "The current usage of the user",
          "hostsDialog.dataLimit": "The usage limit of the user",
          "hostsDialog.remaingDays": "Remaining days of the user",
          "hostsDialog.proxyProtocol": "Proxy protocol (e.g. VMess)",
          "hostsDialog.proxyMethod": "Proxy transport method (e.g. ws)",
          "hostsDialog.currentServer": "Current server ip address",
          "hostsDialog.security": "Security",
          "hostsDialog.addHost": "Add host",
          "hostsDialog.savedSuccess": "Hosts saved successfully",
          "hostsDialog.loading": "loading...",
          "hostsDialog.apply": "Apply",

          // dashboard
          users: "Users",
          activeUsers: "active users",
          dataUsage: "data usage",
          memoryUsage: "memory usage",
          itemsPerPage: "Items per page",
          previous: "Previous",
          next: "Next",
          createNewUser: "Create new user",
          search: "Search",
          resetAllUsage: "Reset All Usage",

          // QRCodeDialog
          "qrcodeDialog.sublink": "Subscribe Link",

          // ResetUserUsageModal
          "resetUserUsage.prompt": "Are you sure you want to reset <b>{{username}}</b>'s usage?",
          "resetUserUsage.title": "Reset User Usage",
          "resetUserUsage.success": "{{username}}'s usage has reset successfully.",
          "resetUserUsage.error": "Usage reset failed, please try again.",

          // ResetAllUsageModal
          "resetAllUsage.title": "Reset All Usage",
          "resetAllUsage.prompt": "Are you sure you want to reset all usage?",
          "resetAllUsage.success": "All usage has reset successfully.",
          "resetAllUsage.error": "Usage reset failed, please try again.",

          hello:""
        }
      },
      zh: {
        translation: {
          //common
          cancel: "取消",
          delete: "删除",
          reset: "重置",
          createUser: "创建用户",
          username: "用户名",
          expires: "{{time}}有效",
          expired: "{{time}}失效",
          dateFormat: "MM/dd/yyyy",

          // page login
          "login.password": "密码",
          "login.login": "登录",
          "login.loginYourAccount": '登录您的帐号',
          "login.welcomeBack": '欢迎回来，请输入您的详细信息',

          // Header
          "header.hostsSetting": "设置",
          "header.donation": "捐赠",
          "header.logout": "退出",

          // DeleteUserModal
          "deleteUser.title": "删除用户",
          "deleteUser.prompt": "您确定你要删除<b>{{username}}</b>？",
          "deleteUser.deleteSuccess": "{{username}}删除成功。",

          // UsersTable
          "usersTable.status": "状态",
          "usersTable.dataUsage": "流量统计",
          "usersTable.noUserMatched": "没有找到您搜索的用户",
          "usersTable.noUser": "还没有添加任何用户",
          "usersTable.copyLink": "复制订阅链接",
          "usersTable.copied": "已复制",
          "usersTable.copyConfigs": "复制配置",

          // UserDialog
          "userDialog.dataLimit": "流量限制",
          "userDialog.periodicUsageReset": "定期重置流量",
          "userDialog.expiryDate": "过期日期",
          "userDialog.resetUsage": "重置流量",
          "userDialog.protocols": "协议",
          "userDialog.editUserTitle": "用户编辑",
          "userDialog.editUser": "修改",
          "userDialog.userEdited": "已更新用户{{username}}。",
          "userDialog.userCreated": "成功创建用户{{username}}。",
          "userDialog.userAlreadyExists": "用户已存在",
          "userDialog.vmessDesc": "快速且安全",
          "userDialog.vlessDesc": "轻量、快速且安全",
          "userDialog.trojanDesc": "轻量、安全且非常快",
          "userDialog.shadowsocksDesc": "快速且安全, 但效率不如其它",
          "userDialog.resetStrategyNo": "无",
          "userDialog.resetStrategyDaily": "每天",
          "userDialog.resetStrategyWeekly": "每周",
          "userDialog.resetStrategyMonthly": "每月",
          "userDialog.resetStrategyAnnually": "每年",

          // HostsDialog
          "hostsDialog.title": "使用此设置，您可以为每个入站分配特定的地址。",
          "hostsDialog.desc": "使用这些变量使其可以动态替换",
          "hostsDialog.username": "用户的用户名",
          "hostsDialog.dataUsage": "用户当前流量情况",
          "hostsDialog.dataLimit": "用户的流量限制",
          "hostsDialog.remaingDays": "用户的剩余天数",
          "hostsDialog.proxyProtocol": "代理协议（例如 VMess）",
          "hostsDialog.proxyMethod": "代理传输方法（例如 ws）",
          "hostsDialog.currentServer": "当前服务器的 IP 地址",
          "hostsDialog.security": "安全协议",
          "hostsDialog.addHost": "添加主机",
          "hostsDialog.savedSuccess": "设置保存成功",
          "hostsDialog.loading": "加载中...",
          "hostsDialog.apply": "保存",

          // dashboard
          users: "用户",
          activeUsers: "活跃用户",
          dataUsage: "总流量",
          memoryUsage: "内存状态",
          itemsPerPage: "每页条数",
          previous: "上一页",
          next: "下一页",
          createNewUser: "创建新用户",
          search: "搜索",
          resetAllUsage: "重置所有统计",

          // QRCodeDialog
          "qrcodeDialog.sublink": "订阅链接",

          // ResetUserUsageModal
          "resetUserUsage.prompt": "您确定要重置<b>{{username}}</b>的流量统计吗？",
          "resetUserUsage.title": "重置用户流量统计",
          "resetUserUsage.success": "{{username}}的流量统计重置完成。",
          "resetUserUsage.error": "重置失败，请稍候再试",

          // ResetAllUsageModal
          "resetAllUsage.title": "重置所有流量统计",
          "resetAllUsage.prompt": "您确定要重置所有流量统计吗？",
          "resetAllUsage.success": "所有流量统计重置完成。",
          "resetAllUsage.error": "重置失败，请稍候再试！",

          hello:""
        }
      }
    }
  });

export default i18n;
