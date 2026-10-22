# GuardianGate — MVP Product Specification

## 1. Tóm tắt quyết định

- **Sản phẩm:** GuardianGate, prototype kiểm soát quyền truy cập và chia sẻ hồ sơ y tế trẻ em bằng dữ liệu giả.
- **Người dùng chính:** Bác sĩ điều trị.
- **Problem:** Quyền tập trung hoặc khả năng bỏ qua quy trình có thể khiến hồ sơ trẻ bị mở hoặc chia sẻ quá mức cần thiết.
- **Core job:** Trong một ca khám hợp lệ, bác sĩ xin và sử dụng đúng nhóm hồ sơ tối thiểu của trẻ, cho đúng mục đích và trong thời hạn được cấp.
- **MVP recommendation:** Chứng minh thực thi policy qua năm luồng: ca khám thường, chia sẻ ngoài, cấp cứu, thay đổi chính sách và audit log.
- **Quyết định build/validation:** Tiếp tục MVP. Giá trị cần kiểm chứng bằng demo là: dữ liệu chỉ mở khi điều kiện nghiệp vụ được thỏa mãn, kể cả khi một người dùng có quyền quản trị cố gắng vượt quy tắc.

## 2. Bối cảnh và bằng chứng

### Bằng chứng từ đầu vào

- Hồ sơ y tế điện tử của trẻ có nguy cơ bị truy cập hoặc chia sẻ quá rộng khi quyền quản trị tập trung hay quy trình có thể bị bypass.
- Người giám hộ phải kiểm soát việc sử dụng hồ sơ của trẻ; bác sĩ cần dữ liệu tối thiểu cho ca khám; ngoại lệ cấp cứu và pháp lý không được là lối tắt toàn quyền.
- Prototype dùng tài khoản và hồ sơ giả lập, không kết nối hay xử lý dữ liệu bệnh nhân thật.
- Mỗi quyền cần bị giới hạn theo trẻ, mục đích, nhóm dữ liệu và thời hạn; xem không mặc nhiên đồng nghĩa với tải xuống hoặc chia sẻ.

### Bằng chứng bên ngoài

Yêu cầu gốc nêu nguyên tắc của WHO về quyền riêng tư trẻ vị thành niên, nhưng không kèm nguồn có thể xác minh trong workspace. Spec này không coi đó là căn cứ pháp lý hay thay thế việc rà soát luật/quy trình bệnh viện.

### Suy luận và phần chưa kiểm chứng

- Một luồng demo tập trung vào policy enforcement có thể kiểm chứng value proposition tốt hơn việc mô phỏng toàn bộ vận hành bệnh viện.
- Tính phù hợp của TideCloak, cơ chế xác thực danh tính thực, cấu hình quorum thực tế và yêu cầu tuân thủ phải được Architecture/implementation xác minh. Chúng không được giả định là đã sẵn sàng cho production.

## 3. Người dùng chính và công việc cốt lõi

- **Primary user:** Bác sĩ điều trị.
- **Bối cảnh sử dụng:** Bác sĩ đã được gán vào một ca khám đang hoạt động của trẻ và cần xem một phần hồ sơ để chăm sóc.
- **Pain/cách làm hiện tại:** Nếu quyền quá rộng, bác sĩ hoặc admin có thể thấy nhiều hơn nhu cầu; nếu kiểm soát mơ hồ, việc chăm sóc hợp lệ bị chậm hoặc không giải thích được quyết định truy cập.
- **Core job:** Gửi yêu cầu có phạm vi rõ và xem đúng dữ liệu đã được policy cấp trong thời hạn hiệu lực.
- **Desired outcome:** Bác sĩ biết yêu cầu đang chờ điều kiện gì, và khi được cấp chỉ xem đúng phần dữ liệu đã xin; mọi quyết định có thể kiểm tra lại.
- **Vai trò phụ bắt buộc:** Người giám hộ hợp pháp; người giám hộ thứ hai khi chia sẻ ngoài; bác sĩ xác nhận thứ hai cho cấp cứu; Privacy Officer và Compliance/Policy Approver cho thay đổi chính sách; admin chỉ có quyền đề xuất/cấu hình theo policy.

## 4. Mục tiêu sản phẩm

### Goals

1. Cấp quyền tối thiểu, có mục đích và có hạn cho một trẻ cụ thể.
2. Hiển thị rõ policy nào đang thiếu trước khi dữ liệu được mở.
3. Chứng minh admin không có quyền override hay “master key”.
4. Ghi audit cho yêu cầu, quyết định, truy cập, thu hồi và ngoại lệ cấp cứu.

### Non-goals

- Tích hợp bệnh án thật, hệ thống bệnh viện thật hoặc dữ liệu bệnh nhân thật.
- Đảm bảo ngăn toàn bộ hình thức rò rỉ như chụp màn hình, ghi chép hay bản in.
- Thay thế quy trình cấp cứu, pháp lý, chăm sóc bệnh nhân hoặc tư vấn tuân thủ pháp luật.
- Khẳng định hệ thống ngăn được nạn buôn bán trẻ em hoặc xác minh hành vi phạm tội.

### Success measurement

- **Outcome cần quan sát:** Trong demo, policy từ chối đúng các tình huống sai và chỉ cấp dữ liệu đúng phạm vi khi đủ điều kiện.
- **Primary metric:** Tỷ lệ kịch bản nghiệm thu MVP hoàn thành với kết quả policy đúng như mong đợi.
- **Guardrail:** Không kịch bản nào trả dữ liệu ngoài phạm vi được duyệt; mọi quyết định và truy cập liên quan đều có audit record.
- **Numeric target có căn cứ:** Không đặt chỉ tiêu số lượng không có căn cứ. Demo phải chạy qua toàn bộ kịch bản nghiệm thu ở mục 8.

## 5. Cơ hội bổ sung giá trị

| Ý tưởng/cách ứng dụng | User và moment | Problem/job | Value | Evidence | Khuyến nghị | Lý do/trade-off | Architecture check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Giải thích “còn thiếu phê duyệt nào” | Bác sĩ/người giám hộ khi yêu cầu pending | Không biết vì sao hồ sơ còn khóa | Giảm mơ hồ và giúp hoàn thành đúng luồng | Yêu cầu đầu vào | MVP | Cần để demo chứng minh policy, không chỉ có nút duyệt | Xem khả năng trả lý do an toàn, không lộ dữ liệu |
| Danh sách rà soát sau cấp cứu | Privacy Officer sau khi cấp cứu | Ngoại lệ dễ bị bỏ quên | Tạo trách nhiệm giải trình | Yêu cầu đầu vào | MVP | Cần cho nguyên tắc ngoại lệ bị ràng buộc | Xác định cơ chế đánh dấu và bảo toàn audit |
| Yêu cầu cung cấp hồ sơ theo pháp lý | Pháp chế/Privacy | Cần cung cấp có phạm vi khi có căn cứ | Mở rộng use case gần kề | Yêu cầu đầu vào | Để sau | Có giá trị nhưng không cần để kiểm chứng core MVP | Đánh giá quy định áp dụng và luồng phê duyệt |
| Tích hợp bệnh án thật | Bệnh viện | Đồng bộ hồ sơ vận hành | Giá trị production | Chưa kiểm chứng | Loại | Không an toàn và ngoài phạm vi hackathon | Chỉ xem xét sau đánh giá compliance, integration |

## 6. Phạm vi

### MVP

1. Đăng nhập/chọn vai trò demo với các tài khoản giả lập.
2. Hồ sơ trẻ được tách nhóm: tóm tắt y tế, hồ sơ lần khám, hình ảnh/kết quả cận lâm sàng và hồ sơ nhạy cảm.
3. Yêu cầu truy cập trong ca khám thường.
4. Duyệt hoặc từ chối của **một người giám hộ hợp pháp** cho yêu cầu ca khám thường.
5. Truy cập đúng phạm vi và thời hạn đã được duyệt; không tải/chia sẻ toàn bộ mặc định.
6. Chia sẻ ngoài: khi có hai người giám hộ đã xác minh, cần cả hai phê duyệt trước khi tạo quyền chia sẻ có giới hạn.
7. Cấp cứu: hai bác sĩ khác nhau, dữ liệu tối thiểu, thời hạn ngắn, có hậu kiểm.
8. Đề xuất thay đổi chính sách: admin đề xuất; cần Privacy Officer và Compliance/Policy Approver phê duyệt độc lập; policy cũ còn hiệu lực cho đến khi quorum đủ.
9. Audit log phân quyền theo nhiệm vụ.

### Để sau (`LATER`)

- Yêu cầu cung cấp hồ sơ theo quy trình pháp lý, với review độc lập của pháp chế và privacy.
- Chính sách chuyên biệt cho từng loại hồ sơ nhạy cảm ngoài các quy tắc demo.
- Xác minh người giám hộ và đồng thuận của trẻ theo quy định áp dụng trong môi trường thật.

### Loại (`REJECT`)

- Dữ liệu bệnh nhân thật, tích hợp EHR/bệnh viện thật và cam kết production compliance trong hackathon.
- Quyền truy cập toàn cục, admin override, khả năng xóa audit log.
- Tuyên bố hệ thống có thể ngăn mọi rò rỉ hoặc giải quyết/vạch trần tội phạm.

## 7. User journey cốt lõi

1. **Trigger:** Bác sĩ điều trị cần một nhóm hồ sơ của trẻ cho ca khám đang hoạt động.
2. **Các bước:** Bác sĩ chọn trẻ/ca khám, nhóm dữ liệu, mục đích và thời hạn; hệ thống kiểm tra điều kiện và tạo yêu cầu `Pending`.
3. **Thông tin cần xem/nhập:** Danh tính người yêu cầu, quan hệ ca khám, nhóm dữ liệu, mục đích, thời hạn và trạng thái phê duyệt.
4. **Hành động và phản hồi:** Người giám hộ hợp pháp chấp thuận hoặc từ chối. Nếu chấp thuận, hệ thống cấp đúng phạm vi; nếu từ chối/thiếu điều kiện/hết hạn, hồ sơ vẫn khóa và nêu trạng thái phù hợp.
5. **Successful end state:** Bác sĩ xem được duy nhất nhóm dữ liệu đã cấp khi quyền còn hiệu lực; hành động được ghi audit.

## 8. Đặc tả từng tính năng MVP

### 8.1 Danh tính demo và hồ sơ trẻ

- **User và tình huống:** Mọi actor đăng nhập bằng tài khoản giả lập trước khi dùng các luồng của mình.
- **Value:** Tránh mơ hồ về chủ thể, role và quan hệ với trẻ.
- **Main flow:** Người dùng chọn tài khoản demo; hệ thống chỉ cho thấy hành động/hồ sơ thuộc nhiệm vụ của role đó.
- **Business rules:** Tài khoản không có quan hệ hợp lệ không được tìm hoặc mở hồ sơ trẻ; admin không được xem nội dung bệnh án.
- **States:** Xác thực thất bại; không có trẻ liên kết; hồ sơ không tồn tại/không có quyền; tải dữ liệu; lỗi policy.
- **Acceptance criteria:**
  - Given một admin đã đăng nhập, when mở hồ sơ trẻ, then hệ thống từ chối và không trả nội dung bệnh án.
  - Given một người giám hộ hợp lệ, when mở danh sách trẻ liên kết, then chỉ các trẻ thuộc quan hệ hợp lệ được hiển thị.

### 8.2 Yêu cầu truy cập ca khám thường

- **User và tình huống:** Bác sĩ điều trị trong ca khám hoạt động cần một nhóm hồ sơ.
- **Value:** Có dữ liệu cần thiết mà không mở toàn bộ hồ sơ.
- **Main flow:** Bác sĩ khai báo trẻ, ca khám, nhóm dữ liệu, mục đích, thời hạn; người giám hộ hợp pháp duyệt hoặc từ chối; khi được duyệt, bác sĩ truy cập đúng phạm vi.
- **Business rules:** Bác sĩ phải thuộc ca khám; không tự duyệt yêu cầu của mình; một người giám hộ hợp pháp duyệt là đủ cho ca khám thường; quyền hết hạn theo thời hạn được cấp hoặc khi ca khám kết thúc; quyền có thể bị thu hồi.
- **States:** `Pending`, `Approved`, `Rejected`, `Expired`, `Revoked`; thiếu ca khám; thiếu mục đích/phạm vi/thời hạn; quyền đã hết hạn.
- **Acceptance criteria:**
  - Given bác sĩ không thuộc ca khám, when tạo hoặc dùng yêu cầu truy cập, then yêu cầu bị từ chối và không có dữ liệu được mở.
  - Given bác sĩ thuộc ca khám nhưng yêu cầu đang `Pending`, when mở hồ sơ, then dữ liệu vẫn khóa và nêu phê duyệt đang chờ.
  - Given yêu cầu đã được một người giám hộ hợp pháp duyệt, when bác sĩ mở hồ sơ trước khi hết hạn, then chỉ nhóm dữ liệu đã xin được hiển thị.
  - Given quyền `Expired` hoặc `Revoked`, when bác sĩ truy cập lại, then hệ thống từ chối.

### 8.3 Chia sẻ hồ sơ ra ngoài

- **User và tình huống:** Người giám hộ cần cấp một phần hồ sơ cho tổ chức bên ngoài.
- **Value:** Bên nhận chỉ có quyền dùng dữ liệu đúng mục đích, đúng phạm vi và đúng thời hạn.
- **Main flow:** Người giám hộ ghi bên nhận, mục đích, nhóm dữ liệu, thời hạn; hệ thống thu phê duyệt; chỉ khi đủ điều kiện mới tạo quyền chia sẻ giới hạn.
- **Business rules:** Nếu có hai người giám hộ đã xác minh thì bắt buộc cả hai cùng duyệt; thiếu bất kỳ phê duyệt nào thì không tạo/gửi bản chia sẻ; quyền chia sẻ không mở toàn bộ hồ sơ mặc định.
- **States:** Chưa tạo yêu cầu; chờ từng người giám hộ; bị từ chối; đã cấp; hết hạn/thu hồi; bên nhận hoặc phạm vi không hợp lệ.
- **Acceptance criteria:**
  - Given trẻ có hai người giám hộ đã xác minh và chỉ một người đã duyệt, when kiểm tra yêu cầu, then trạng thái vẫn chờ và dữ liệu chưa được chia sẻ.
  - Given cả hai người giám hộ đã duyệt, when tạo quyền chia sẻ, then chỉ người nhận, mục đích, nhóm dữ liệu và thời hạn đã được duyệt mới có hiệu lực.

### 8.4 Truy cập cấp cứu

- **User và tình huống:** Không thể liên hệ người giám hộ kịp thời và bác sĩ cần thông tin để xử lý cấp cứu.
- **Value:** Có đường ngoại lệ an toàn cho dữ liệu tối thiểu cần thiết.
- **Main flow:** Bác sĩ A nêu lý do và yêu cầu cấp cứu; bác sĩ B xác nhận độc lập; hệ thống mở tóm tắt y tế trong thời hạn ngắn, thông báo người giám hộ khi có thể và đưa sự kiện vào hậu kiểm.
- **Business rules:** Hai bác sĩ phải là hai chủ thể khác nhau; không được dùng luồng này để tải/chia sẻ toàn bộ hồ sơ; chỉ tóm tắt y tế tối thiểu được mở; quyền tự hết hạn.
- **States:** Chờ xác nhận độc lập; bị từ chối do cùng người xác nhận; đã cấp; hết hạn; cần hậu kiểm; lỗi/thông tin lý do thiếu.
- **Acceptance criteria:**
  - Given chỉ có bác sĩ A yêu cầu, when A mở dữ liệu cấp cứu, then hệ thống từ chối cho đến khi có xác nhận độc lập.
  - Given bác sĩ B khác A đã xác nhận, when mở quyền cấp cứu, then chỉ tóm tắt y tế tối thiểu được xem trong thời hạn giới hạn và audit được tạo.

### 8.5 Đề xuất thay đổi chính sách và quorum

- **User và tình huống:** Admin muốn đổi cấu hình nhạy cảm, như ngưỡng phê duyệt.
- **Value:** Giữ policy có hiệu lực khỏi thay đổi đơn phương.
- **Main flow:** Admin đề xuất thay đổi; Privacy Officer và Compliance/Policy Approver duyệt độc lập; chỉ sau khi đủ hai phê duyệt policy mới có hiệu lực.
- **Business rules:** Admin đề xuất không được tính là phê duyệt; admin không được tự thêm quyền xem cho mình, tắt yêu cầu người giám hộ, tạo quyền toàn cục hoặc xóa audit; policy cũ tiếp tục có hiệu lực trước quorum.
- **States:** Draft/proposed; chờ Privacy; chờ Compliance; rejected; approved/effective; proposal invalid.
- **Acceptance criteria:**
  - Given admin đề xuất cấp quyền toàn bộ cho mình, when proposal chưa có đủ quorum, then proposal không có hiệu lực và admin vẫn không truy cập được hồ sơ.
  - Given Privacy Officer và Compliance/Policy Approver cùng duyệt một proposal hợp lệ, when quorum hoàn tất, then hệ thống phân biệt rõ policy mới đã có hiệu lực với proposal trước đó.

### 8.6 Audit log

- **User và tình huống:** Người giám hộ, bác sĩ, privacy và admin cần xem phần audit đúng nhiệm vụ của mình.
- **Value:** Truy vết được vì sao ai đó đã hoặc không được truy cập.
- **Main flow:** Mỗi yêu cầu, phê duyệt/từ chối, truy cập, thu hồi, cấp cứu và proposal policy tạo bản ghi; người dùng xem phạm vi log được phép.
- **Business rules:** Log lưu chủ thể, trẻ liên quan, nhóm dữ liệu, mục đích, quyết định, thời gian hiệu lực, sự kiện cấp cứu/thu hồi; người dùng thường không sửa/xóa được; admin chỉ xem log kỹ thuật không gồm nội dung bệnh án.
- **States:** Không có log phù hợp; đang tải; lọc không có kết quả; không được phép xem; log có liên kết bị thu hồi nhưng vẫn phải giữ dấu vết.
- **Acceptance criteria:**
  - Given một yêu cầu được tạo rồi bị từ chối, when actor có quyền mở audit, then log thể hiện người yêu cầu, người quyết định, thời điểm, phạm vi và kết quả.
  - Given một truy cập cấp cứu đã hết hạn, when Privacy Officer xem hậu kiểm, then log vẫn thể hiện lý do, hai bác sĩ, phạm vi tối thiểu và thời điểm hết hạn.

## 9. Ràng buộc và rủi ro sản phẩm

- **Policy/legal/privacy:** Chỉ dùng dữ liệu giả. Quy tắc người giám hộ, đồng thuận của trẻ, cấp cứu và cung cấp theo pháp lý phải được rà soát theo luật/quy trình địa phương trước khi sử dụng thật.
- **Brand/operations:** Demo phải nói rõ đây là prototype kiểm soát truy cập, không phải công cụ phòng chống tội phạm hay đảm bảo chống rò rỉ tuyệt đối.
- **External dependency:** Tích hợp TideCloak phải chứng minh backend thực thi danh tính/policy, không chỉ mô phỏng nút bấm ở UI.
- **Product risk:** Sự khác biệt giữa “xem trong ca khám” và “chia sẻ ngoài” cần hiển thị rõ để người xem không hiểu nhầm hai người giám hộ phải duyệt mọi ca khám thường.

## 10. Handoff cho Architecture

- **Product decisions bất biến:** Least privilege; deny by default; không admin override; một người giám hộ hợp pháp duyệt ca khám thường; hai người giám hộ đã xác minh duyệt chia sẻ ngoài; hai bác sĩ độc lập cho cấp cứu; Privacy + Compliance duyệt thay đổi policy nhạy cảm; audit không thể bị người dùng thường sửa/xóa.
- **Feasibility cần kiểm tra:** TideCloak có thể thực thi các điều kiện nghiệp vụ, bảo toàn policy/quorum và giới hạn dữ liệu theo phạm vi/thời hạn hay không.
- **Technical risks cần đánh giá:** Enforcement phải ở backend và các đường truy cập dữ liệu phải nhất quán; tính độc lập của người phê duyệt; thu hồi/hết hạn có hiệu lực ngay; audit tamper-resistance trong prototype.
- **Nhu cầu dữ liệu ở mức nghiệp vụ:** Actor/role, quan hệ người giám hộ–trẻ, ca khám, nhóm hồ sơ, yêu cầu, quyết định phê duyệt, quyền có hạn, proposal policy và sự kiện audit.
- **Constraints Architecture phải tôn trọng:** Chỉ dữ liệu giả; không có endpoint/luồng bypass policy; không chuyển approval thành điều kiện UI thuần túy; không mở rộng sang hồ sơ thật.

## 11. Thông tin tài liệu

- **Trạng thái:** Đã duyệt (`APPROVED`)
- **Người duyệt:** Người dùng
- **Ngày cập nhật:** 2026-10-22
- **Nguồn đầu vào:** Requirement GuardianGate phiên bản 1.0 do người dùng cung cấp và các xác nhận scope trong cuộc trao đổi này.
