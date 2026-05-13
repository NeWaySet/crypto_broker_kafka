from pathlib import Path
from textwrap import dedent

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "lab-kafka-iot"
OUT_DIR = ROOT / "artifacts"
ASSET_DIR = OUT_DIR / "report_assets"
REPORT_PATH = OUT_DIR / "Практическая_работа_Криптоконтейнеры_Kafka_Docker.docx"

BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
INK = RGBColor(11, 37, 69)
GRAY = RGBColor(92, 102, 112)
LIGHT_BLUE = "E8EEF5"
LIGHT_GRAY = "F2F4F7"
PALE_YELLOW = "FFF2CC"


def font_path():
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


FONT = font_path()


def load_font(size, bold=False):
    if FONT:
        return ImageFont.truetype(FONT, size=size)
    return ImageFont.load_default()


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_border(cell, color="D0D7DE", size="6"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        tag = "w:{}".format(edge)
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_table_width(table):
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), "9360")
    tbl_w.set(qn("w:type"), "dxa")


def set_paragraph_border_bottom(paragraph, color="2E74B5", size="12"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)
    p_pr.append(p_bdr)


def set_run_font(run, name="Calibri", size=None, color=None, bold=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run._element.rPr.rFonts.set(qn("w:cs"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.bold = bold


def add_paragraph(doc, text="", style=None, before=0, after=6, line=1.25):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = line
    if text:
        p.add_run(text)
    return p


def add_code(doc, code):
    for line in dedent(code).strip("\n").splitlines():
        p = add_paragraph(doc, after=0, line=1.05)
        p.paragraph_format.left_indent = Cm(0.35)
        run = p.add_run(line)
        set_run_font(run, name="Consolas", size=8.5, color=RGBColor(39, 46, 55))
    add_paragraph(doc, after=4)


def style_document(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for name, size, color, before, after in [
        ("Title", 24, INK, 0, 6),
        ("Subtitle", 13, GRAY, 0, 12),
        ("Heading 1", 16, BLUE, 18, 10),
        ("Heading 2", 13, BLUE, 14, 7),
        ("Heading 3", 12, DARK_BLUE, 10, 5),
    ]:
        style = styles[name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        style.font.size = Pt(size)
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.line_spacing = 1.25


def header_footer(doc):
    section = doc.sections[0]
    header = section.header.paragraphs[0]
    header.text = "IoT + Kafka + Docker + Grafana"
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_run_font(header.runs[0], size=9, color=GRAY, bold=True)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.text = "Практическая работа"
    set_run_font(footer.runs[0], size=9, color=GRAY)


def draw_box(draw, xy, text, fill, outline, font, width=3):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=width)
    lines = text.split("\n")
    total = sum(draw.textbbox((0, 0), line, font=font)[3] for line in lines) + (len(lines) - 1) * 8
    y = y1 + ((y2 - y1) - total) / 2 - 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        x = x1 + ((x2 - x1) - (bbox[2] - bbox[0])) / 2
        draw.text((x, y), line, fill=(25, 35, 45), font=font)
        y += bbox[3] - bbox[1] + 8


def draw_arrow(draw, start, end, label, font, color=(68, 84, 106), label_offset=(0, -28)):
    draw.line([start, end], fill=color, width=4)
    ex, ey = end
    sx, sy = start
    if ex >= sx:
        points = [(ex, ey), (ex - 16, ey - 8), (ex - 16, ey + 8)]
    else:
        points = [(ex, ey), (ex + 16, ey - 8), (ex + 16, ey + 8)]
    draw.polygon(points, fill=color)
    mx = (start[0] + end[0]) / 2 + label_offset[0]
    my = (start[1] + end[1]) / 2 + label_offset[1]
    bbox = draw.textbbox((0, 0), label, font=font)
    draw.rounded_rectangle((mx - (bbox[2] - bbox[0]) / 2 - 8, my - 5, mx + (bbox[2] - bbox[0]) / 2 + 8, my + 22), radius=7, fill=(255, 255, 255))
    draw.text((mx - (bbox[2] - bbox[0]) / 2, my), label, fill=color, font=font)


def draw_poly_arrow(draw, points, label, font, color=(68, 84, 106), label_point=None):
    draw.line(points, fill=color, width=4, joint="curve")
    ex, ey = points[-1]
    px, py = points[-2]
    if abs(ex - px) >= abs(ey - py):
        if ex >= px:
            arrow = [(ex, ey), (ex - 16, ey - 8), (ex - 16, ey + 8)]
        else:
            arrow = [(ex, ey), (ex + 16, ey - 8), (ex + 16, ey + 8)]
    else:
        if ey >= py:
            arrow = [(ex, ey), (ex - 8, ey - 16), (ex + 8, ey - 16)]
        else:
            arrow = [(ex, ey), (ex - 8, ey + 16), (ex + 8, ey + 16)]
    draw.polygon(arrow, fill=color)

    if label_point is None:
        label_point = points[len(points) // 2]
    mx, my = label_point
    bbox = draw.textbbox((0, 0), label, font=font)
    draw.rounded_rectangle((mx - (bbox[2] - bbox[0]) / 2 - 8, my - 5, mx + (bbox[2] - bbox[0]) / 2 + 8, my + 22), radius=7, fill=(255, 255, 255))
    draw.text((mx - (bbox[2] - bbox[0]) / 2, my), label, fill=color, font=font)


def make_architecture_png(path):
    img = Image.new("RGB", (1600, 760), "white")
    draw = ImageDraw.Draw(img)
    title_font = load_font(36, True)
    label_font = load_font(24)
    small_font = load_font(18)
    draw.text((40, 30), "Архитектура защищенного обмена сообщениями", fill=(11, 37, 69), font=title_font)
    draw.rounded_rectangle((35, 95, 1565, 705), radius=26, outline=(208, 215, 222), width=3, fill=(248, 250, 252))

    boxes = {
        "producer": (65, 300, 245, 390, "Producer\ninput", (218, 232, 252), (108, 142, 191)),
        "kafka1": (315, 300, 495, 390, "Kafka\nsensors.raw", (255, 242, 204), (214, 182, 86)),
        "gateway": (565, 285, 765, 405, "Crypto Gateway\nPEP + Facade", (213, 232, 212), (130, 179, 102)),
        "policy": (565, 95, 765, 205, "Policy Engine\nPDP", (232, 222, 248), (150, 115, 166)),
        "kafka2": (835, 300, 1015, 390, "Kafka\nsensors.crypto", (255, 242, 204), (214, 182, 86)),
        "filter": (1085, 285, 1265, 405, "Filter\nsanitize + decrypt", (248, 206, 204), (184, 84, 80)),
        "consumer": (1335, 220, 1535, 310, "Consumer\nfiltered logs", (225, 213, 231), (150, 115, 166)),
        "grafana": (1335, 405, 1535, 495, "Grafana\ndashboard", (255, 230, 204), (215, 155, 0)),
    }
    for box in boxes.values():
        draw_box(draw, box[:4], box[4], box[5], box[6], label_font)

    draw_arrow(draw, (245, 345), (315, 345), "plain JSON", small_font)
    draw_arrow(draw, (495, 345), (565, 345), "consume", small_font, label_offset=(0, -48))
    draw_arrow(draw, (665, 285), (665, 205), "policy request", small_font, label_offset=(92, -12))
    draw_arrow(draw, (765, 345), (835, 345), "crypto container", small_font, label_offset=(0, -50))
    draw_arrow(draw, (1015, 345), (1085, 345), "decrypt", small_font, label_offset=(0, -48))
    draw_arrow(draw, (1265, 330), (1335, 265), "filtered", small_font)
    draw_arrow(draw, (1265, 380), (1335, 450), "metrics", small_font)
    img.save(path)


def make_sequence_png(path):
    img = Image.new("RGB", (1600, 720), "white")
    draw = ImageDraw.Draw(img)
    title_font = load_font(36, True)
    label_font = load_font(24)
    small_font = load_font(18)
    draw.text((40, 30), "Сценарий прохождения сообщения", fill=(11, 37, 69), font=title_font)

    xs = [140, 430, 720, 1010, 1300]
    labels = ["User", "Producer", "Crypto Gateway", "Policy Engine", "Filter/Consumer"]
    fills = [(218, 232, 252), (213, 232, 212), (255, 242, 204), (248, 206, 204), (255, 230, 204)]
    outlines = [(108, 142, 191), (130, 179, 102), (214, 182, 86), (184, 84, 80), (215, 155, 0)]
    for x, label, fill, outline in zip(xs, labels, fills, outlines):
        draw_box(draw, (x - 105, 115, x + 105, 180), label, fill, outline, small_font)
        draw.line((x, 180, x, 610), fill=(208, 215, 222), width=3)

    steps = [
        (xs[0], xs[1], 240, "1. text or JSON"),
        (xs[1], xs[2], 315, "2. sensors.raw"),
        (xs[2], xs[3], 390, "3. ask policy"),
        (xs[3], xs[2], 465, "4. allow/deny"),
        (xs[2], xs[4], 540, "5. encrypted -> filtered"),
    ]
    for sx, ex, y, label in steps:
        draw_arrow(draw, (sx, y), (ex, y), label, small_font)
    img.save(path)


def make_class_png(path):
    img = Image.new("RGB", (1600, 760), "white")
    draw = ImageDraw.Draw(img)
    title_font = load_font(36, True)
    label_font = load_font(21)
    small_font = load_font(17)
    draw.text((40, 30), "Диаграмма классов и примененные шаблоны", fill=(11, 37, 69), font=title_font)

    classes = [
        (70, 145, 420, 305, "MessageTypeStrategy\n+ detect(payload)\nPattern: Strategy", (218, 232, 252), (108, 142, 191)),
        (485, 145, 835, 305, "PolicyDecisionPoint\n+ decide(request)\nСКИБ: PDP", (232, 222, 248), (150, 115, 166)),
        (900, 145, 1250, 305, "CryptoContainerFacade\n+ seal(payload, decision)\nPattern: Facade", (213, 232, 212), (130, 179, 102)),
        (70, 405, 420, 565, "CryptoContainerAdapter\n+ open(container)\nPattern: Adapter", (255, 242, 204), (214, 182, 86)),
        (485, 405, 835, 565, "Sanitizer\n+ clean(payload)\nСКИБ: очистка данных", (248, 206, 204), (184, 84, 80)),
        (900, 405, 1250, 565, "Kafka connect factory\n+ connect()\nFactory Method style", (225, 213, 231), (150, 115, 166)),
    ]
    for x1, y1, x2, y2, text, fill, outline in classes:
        draw_box(draw, (x1, y1, x2, y2), text, fill, outline, label_font)
    draw_arrow(draw, (420, 225), (485, 225), "classifies", small_font)
    draw_arrow(draw, (835, 225), (900, 225), "authorizes", small_font)
    draw_arrow(draw, (420, 485), (485, 485), "opens then cleans", small_font)
    draw_arrow(draw, (1075, 305), (245, 405), "encrypted envelope", small_font, label_offset=(0, 18))
    img.save(path)


def add_metadata_table(doc):
    rows = [
        ("Тема", "Система обмена сообщениями с криптографической защитой информации"),
        ("Стек", "Docker Compose, Apache Kafka KRaft, Python, Fernet crypto containers, Grafana"),
        ("Подход", "Кибериммунная декомпозиция: изолированные компоненты и заданная политика"),
        ("Особенность", "Policy engine принимает решение, crypto-gateway применяет его и шифрует payload"),
    ]
    table = doc.add_table(rows=len(rows), cols=2)
    set_table_width(table)
    for row_idx, (label, value) in enumerate(rows):
        row = table.rows[row_idx]
        row.cells[0].width = Inches(1.55)
        row.cells[1].width = Inches(4.95)
        for cell in row.cells:
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_border(cell)
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.15
        set_cell_shading(row.cells[0], LIGHT_BLUE)
        run = row.cells[0].paragraphs[0].add_run(label)
        set_run_font(run, size=10, color=INK, bold=True)
        run = row.cells[1].paragraphs[0].add_run(value)
        set_run_font(run, size=10.5, color=RGBColor(30, 41, 59))
    add_paragraph(doc, after=8)


def add_component_table(doc):
    rows = [
        ("Producer", "Изолированный источник сообщений. Публикует только в sensors.raw и не имеет ключа шифрования."),
        ("Policy Engine", "Policy Decision Point: принимает решения allow/deny по policy/policy.json."),
        ("Crypto Gateway", "Policy Enforcement Point: применяет решение политики и создает криптоконтейнер."),
        ("Kafka", "Брокер в режиме KRaft. Разделяет raw, crypto, policy и filtered топики."),
        ("Filter", "Открывает криптоконтейнер, очищает текст, валидирует данные датчиков."),
        ("Consumer/Grafana", "Получают только отфильтрованные данные из sensors.data.filtered."),
    ]
    table = doc.add_table(rows=1, cols=2)
    set_table_width(table)
    headers = ["Компонент", "Назначение"]
    for idx, header in enumerate(headers):
        cell = table.rows[0].cells[idx]
        set_cell_shading(cell, LIGHT_BLUE)
        set_cell_border(cell)
        run = cell.paragraphs[0].add_run(header)
        set_run_font(run, size=10.5, color=INK, bold=True)
    for component, purpose in rows:
        cells = table.add_row().cells
        for cell in cells:
            set_cell_border(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        cells[0].width = Inches(1.35)
        cells[1].width = Inches(5.15)
        run = cells[0].paragraphs[0].add_run(component)
        set_run_font(run, size=10, color=DARK_BLUE, bold=True)
        run = cells[1].paragraphs[0].add_run(purpose)
        set_run_font(run, size=10)
    add_paragraph(doc, after=8)


def add_project_tree(doc):
    add_code(
        doc,
        """
        lab-kafka-iot/
        ├── docker-compose.yml
        ├── policy/
        │   └── policy.json
        ├── producer/
        │   ├── app.py
        │   └── Dockerfile
        ├── policy-engine/
        │   ├── app.py
        │   └── Dockerfile
        ├── crypto-gateway/
        │   ├── app.py
        │   └── Dockerfile
        ├── filter/
        │   ├── app.py
        │   └── Dockerfile
        ├── consumer/
        │   ├── app.py
        │   └── Dockerfile
        ├── diagrams/
        │   ├── architecture.drawio
        │   └── sequence.drawio
        └── README.md
        """,
    )


def add_commands(doc):
    add_code(
        doc,
        """
        docker compose up --build -d kafka kafka-init policy-engine crypto-gateway filter consumer grafana
        docker compose run --rm producer
        docker compose logs -f policy-engine
        docker compose logs -f crypto-gateway
        docker compose logs -f filter
        docker compose logs -f consumer
        docker compose down
        """,
    )


def build_report():
    OUT_DIR.mkdir(exist_ok=True)
    ASSET_DIR.mkdir(exist_ok=True)
    architecture_png = ASSET_DIR / "architecture.png"
    sequence_png = ASSET_DIR / "sequence.png"
    class_png = ASSET_DIR / "classes.png"
    make_architecture_png(architecture_png)
    make_sequence_png(sequence_png)
    make_class_png(class_png)

    doc = Document()
    style_document(doc)
    header_footer(doc)

    p = add_paragraph(doc, "ПРОЕКТНАЯ РАБОТА", style="Title", after=2)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_paragraph_border_bottom(p)
    p = add_paragraph(doc, "Система обмена сообщениями с криптографической защитой информации", style="Subtitle", after=18)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_metadata_table(doc)

    p = add_paragraph(
        doc,
        "Проект оформлен как развитие практики с IoT-сообщениями: обмен вынесен в изолированные контейнеры, Kafka используется как брокер, а полезная нагрузка проходит через криптоконтейнер и заданную политику безопасности.",
        after=12,
    )
    p.runs[0].font.color.rgb = RGBColor(30, 41, 59)

    doc.add_heading("Цель работы", level=1)
    add_paragraph(
        doc,
        "Разработать прототип системы обмена сообщениями с криптографической защитой информации, изолированными компонентами, брокером сообщений и явно заданной политикой безопасности.",
    )

    doc.add_heading("Задачи", level=1)
    for item in [
        "разделить систему на контейнеры с минимальными обязанностями;",
        "создать криптоконтейнер для защиты payload сообщения;",
        "выделить policy-engine для принятия решений безопасности;",
        "реализовать crypto-gateway как точку применения политики;",
        "оформить архитектуру, диаграмму взаимодействия и диаграмму классов.",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)

    doc.add_heading("Структурная схема", level=1)
    add_paragraph(doc, "Основной поток данных построен по принципу минимизации поверхности защиты: producer не знает ключ шифрования, policy-engine не шифрует данные, filter не принимает решения доступа, а Kafka только маршрутизирует сообщения.")
    doc.add_picture(str(architecture_png), width=Inches(6.45))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = add_paragraph(doc, "Рисунок 1. Архитектура защищенного обмена сообщениями.", after=12)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].font.size = Pt(9)
    p.runs[0].font.color.rgb = GRAY

    doc.add_heading("Компоненты системы", level=1)
    add_component_table(doc)

    doc.add_heading("Сценарий передачи сообщения", level=1)
    doc.add_picture(str(sequence_png), width=Inches(6.45))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = add_paragraph(doc, "Рисунок 2. Последовательность обработки и защиты сообщения.", after=12)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].font.size = Pt(9)
    p.runs[0].font.color.rgb = GRAY

    doc.add_heading("Диаграмма классов", level=1)
    add_paragraph(doc, "В реализации специально выделены классы, соответствующие шаблонам проектирования ПО и шаблонам конструктивной информационной безопасности.")
    doc.add_picture(str(class_png), width=Inches(6.45))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = add_paragraph(doc, "Рисунок 3. Классы и шаблоны проектирования.", after=12)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].font.size = Pt(9)
    p.runs[0].font.color.rgb = GRAY

    doc.add_heading("Структура проекта", level=1)
    add_project_tree(doc)

    doc.add_heading("Политика архитектуры", level=1)
    add_paragraph(doc, "Поверхность защиты минимизирована за счет разнесения доверенных функций: ключ шифрования доступен только crypto-gateway и filter; policy-engine работает только с метаданными и payload для решения allow/deny; consumer получает уже очищенные данные.")
    add_code(
        doc,
        """
        sensors.raw        - входной топик без внешнего доступа к бизнес-обработке
        policy.requests    - запросы на принятие решения безопасности
        policy.decisions   - решения allow/deny
        sensors.crypto     - криптоконтейнеры с зашифрованным payload
        sensors.data.filtered - очищенные и валидированные данные
        """,
    )

    doc.add_heading("Ключевая настройка Docker Compose", level=1)
    add_paragraph(doc, "Kafka запускается без ZooKeeper, в режиме KRaft. Отдельный контейнер kafka-init создает топики для данных, криптоконтейнеров и политики.")
    add_code(
        doc,
        """
        kafka:
          image: apache/kafka:3.7.0
          environment:
            KAFKA_PROCESS_ROLES: broker,controller
            KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093

        kafka-init:
          command:
            /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --create --if-not-exists --topic sensors.raw
            /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --create --if-not-exists --topic sensors.crypto
            /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --create --if-not-exists --topic sensors.data.filtered
            /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --create --if-not-exists --topic policy.requests
            /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --create --if-not-exists --topic policy.decisions
        """,
    )

    doc.add_heading("Криптоконтейнер", level=1)
    add_paragraph(doc, "Crypto-gateway упаковывает полезную нагрузку в контейнер с версией, алгоритмом, ciphertext и сведениями о политике. Для учебного прототипа используется Fernet, который совмещает симметричное шифрование и контроль целостности.")
    add_code(
        doc,
        """
        {
          "container_version": "1.0",
          "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
          "ciphertext": "...",
          "policy": {"decision": "allow", "policy_version": "1.0"}
        }
        """,
    )

    doc.add_heading("Ручная отправка сообщений", level=1)
    add_paragraph(doc, "Producer поддерживает три сценария: обычный текст, JSON-объект и команду /sample. После отправки сообщение проходит через policy-engine и crypto-gateway.")
    add_code(
        doc,
        """
        Привет из Kafka
        {"sensor_id":"sensor_1","temperature":23.4,"humidity":48.2}
        /sample
        """,
    )

    doc.add_heading("Примененные шаблоны", level=1)
    add_paragraph(doc, "СКИБ: использованы раздельное принятие и применение решений о безопасности, а также выделенный обработчик для очистки данных. Шаблоны ПО: Strategy для определения типа сообщения, Facade для создания криптоконтейнера, Adapter для открытия криптоконтейнера, Factory Method style для создания Kafka-клиентов.")

    doc.add_heading("Фильтрация", level=1)
    add_paragraph(doc, "Filter расшифровывает криптоконтейнер, удаляет опасные фрагменты текста, проверяет температуру в диапазоне от -20 до 50 °C и влажность от 0 до 100 %. Сообщения без полей датчиков считаются текстовыми.")
    add_code(
        doc,
        """
        if not -20.0 <= temperature <= 50.0:
            return False, "temperature outside -20..50 C"
        if not 0.0 <= humidity <= 100.0:
            return False, "humidity outside 0..100 %"
        return True, "sensor-data"
        """,
    )

    doc.add_heading("Запуск и проверка", level=1)
    add_commands(doc)
    add_paragraph(doc, "После запуска Grafana доступна по адресу http://localhost:3000. Источник данных Kafka подключается к bootstrap server kafka:9092, затем для панели выбирается топик sensors.data.filtered.")

    doc.add_heading("Вывод", level=1)
    add_paragraph(
        doc,
        "В результате получен прототип кибериммунной системы обмена сообщениями: компоненты изолированы, взаимодействие идет через брокер, payload защищается криптоконтейнером, а решение безопасности отделено от точки его применения.",
    )

    doc.add_heading("Источники", level=1)
    for source in [
        "securitybydesign.ru/templates/ - шаблоны конструктивной информационной безопасности.",
        "refactoringu.ru/ru/design-patterns/catalog.html - каталог шаблонов проектирования ПО.",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(source)

    doc.save(REPORT_PATH)
    print(REPORT_PATH)


if __name__ == "__main__":
    build_report()
