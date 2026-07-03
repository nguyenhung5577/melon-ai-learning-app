# Báo cáo Kiểm thử Tự động (Automated Testing Report)
**Project Assignment 5 (PA5) - Melon AI Learning App**

## 1. Môi trường và Công cụ
- **Công cụ Automation:** Katalon Studio
- **Môi trường Test:** Trình duyệt Chrome, Ứng dụng Web chạy tại `http://localhost:3000`
- **Tài khoản Test:**
  - Kid 1 (Free): ID `em1`, Pass `123123`
  - Kid 2 (Pro): ID `con2`, Pass `123123`

---

## 2. Kịch bản Kiểm thử Tự động

### Use-Case 1: Xác thực & Phân quyền (ML-AUTH)

#### Scenario 1.1: Đăng nhập tài khoản Học sinh (Kid) thành công
- **Test Case Name:** TC_AUTH_01_Kid_Login_Success
- **Mô tả:** Kiểm tra việc học sinh đăng nhập thành công bằng ID và được chuyển hướng vào Dashboard (Progress).
- **Kết quả (Test Result):** **Passed**
- **Test Script (Katalon Groovy):**
```groovy
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

WebUI.openBrowser('')
WebUI.navigateToUrl('http://localhost:3000/')

// Mở popup đăng nhập từ trang chủ
WebUI.click(findTestObject('Page_Home/btn_OpenLoginModal'))

// Nhập thông tin đăng nhập
WebUI.setText(findTestObject('Page_Home/input_Identifier'), 'em1')
WebUI.setEncryptedText(findTestObject('Page_Home/input_Password'), '123123')
WebUI.click(findTestObject('Page_Home/btn_LoginSubmit'))

// Chờ và xác nhận đăng nhập thành công (chuyển sang /progress)
WebUI.waitForPageLoad(5)
WebUI.verifyUrl('http://localhost:3000/progress')

WebUI.closeBrowser()
```

#### Scenario 1.2: Đăng nhập thất bại do sai mật khẩu
- **Test Case Name:** TC_AUTH_02_Kid_Login_Wrong_Password
- **Mô tả:** Kiểm tra hệ thống hiển thị cảnh báo lỗi khi nhập sai mật khẩu.
- **Kết quả (Test Result):** **Passed**
- **Test Script (Katalon Groovy):**
```groovy
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

WebUI.openBrowser('')
WebUI.navigateToUrl('http://localhost:3000/')

// Mở popup đăng nhập từ trang chủ
WebUI.click(findTestObject('Page_Home/btn_OpenLoginModal'))

// Nhập sai thông tin đăng nhập
WebUI.setText(findTestObject('Page_Home/input_Identifier'), 'em1')
WebUI.setEncryptedText(findTestObject('Page_Home/input_Password'), 'wrongpass')
WebUI.click(findTestObject('Page_Home/btn_LoginSubmit'))

// Xác nhận hiển thị thông báo lỗi
WebUI.verifyElementPresent(findTestObject('Page_Home/text_ErrorMessage'), 5)
WebUI.verifyElementText(findTestObject('Page_Home/text_ErrorMessage'), 'Thông tin đăng nhập không chính xác')

WebUI.closeBrowser()
```

---

### Use-Case 2: Subscription Paywall & Feature Gating (ML-SUBS)

#### Scenario 2.1: Chặn Kid Free sử dụng tính năng Pro (Tách đề)
- **Test Case Name:** TC_SUBS_01_KidFree_Paywall
- **Mô tả:** Kid Free truy cập vào trang Luyện tập và cố gắng sử dụng tính năng Upload/Tách đề sẽ bị chặn bởi Paywall.
- **Kết quả (Test Result):** **Passed**
- **Test Script (Katalon Groovy):**
```groovy
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

WebUI.openBrowser('')

// Đăng nhập Kid Free
WebUI.navigateToUrl('http://localhost:3000/')
WebUI.click(findTestObject('Page_Home/btn_OpenLoginModal'))
WebUI.setText(findTestObject('Page_Home/input_Identifier'), 'em1')
WebUI.setEncryptedText(findTestObject('Page_Home/input_Password'), '123123')
WebUI.click(findTestObject('Page_Home/btn_LoginSubmit'))
WebUI.waitForPageLoad(5)

// Truy cập trang Practice
WebUI.navigateToUrl('http://localhost:3000/practice')
WebUI.waitForPageLoad(5)

// Xác nhận hiển thị Paywall và nút Upload bị vô hiệu hóa
WebUI.verifyElementPresent(findTestObject('Page_Practice/text_Paywall_Message'), 5)
WebUI.verifyElementAttributeValue(findTestObject('Page_Practice/btn_Upload'), 'disabled', 'true', 2)

WebUI.closeBrowser()
```

#### Scenario 2.2: Kid Pro được phép sử dụng tính năng Upload
- **Test Case Name:** TC_SUBS_02_KidPro_Access
- **Mô tả:** Kid Pro truy cập trang Luyện tập có thể nhìn thấy nút Upload bình thường và không có Paywall.
- **Kết quả (Test Result):** **Passed**
- **Test Script (Katalon Groovy):**
```groovy
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

WebUI.openBrowser('')

// Đăng nhập Kid Pro
WebUI.navigateToUrl('http://localhost:3000/')
WebUI.click(findTestObject('Page_Home/btn_OpenLoginModal'))
WebUI.setText(findTestObject('Page_Home/input_Identifier'), 'con2')
WebUI.setEncryptedText(findTestObject('Page_Home/input_Password'), '123123')
WebUI.click(findTestObject('Page_Home/btn_LoginSubmit'))
WebUI.waitForPageLoad(5)

// Truy cập trang Practice
WebUI.navigateToUrl('http://localhost:3000/practice')
WebUI.waitForPageLoad(5)

// Xác nhận Paywall KHÔNG hiển thị và nút Upload có thể click
WebUI.verifyElementNotPresent(findTestObject('Page_Practice/text_Paywall_Message'), 2)
WebUI.verifyElementClickable(findTestObject('Page_Practice/btn_Upload'))

WebUI.closeBrowser()
```
