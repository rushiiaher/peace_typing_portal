import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

// ── Builtin Marathi letter templates ──────────────────────────────────────────
const BUILTIN_MARATHI_LETTERS = [
    {
        id: 'builtin-mr-letter-1',
        title: 'नोकरीसाठी अर्ज (Job Application Letter)',
        category: 'official',
        template_content: JSON.stringify({
            letterhead: 'विश्वकर्मा उद्योग समूह',
            sender_address: 'अ/प मनोज पाटील\n१२, शिवाजी नगर, पुणे - ४११ ००५',
            ref_number: 'MP/2024/01',
            date: '१ जानेवारी २०२४',
            receiver_address: 'मा. व्यवस्थापक\nविश्वकर्मा उद्योग समूह\nएम.आय.डी.सी., औरंगाबाद - ४३१ ००१',
            subject: 'लेखापाल पदासाठी अर्ज',
            salutation: 'मान्यवर,',
            body_para_1: 'वरील विषयाच्या अनुषंगाने मी आपणास कळवू इच्छितो की, आपल्या कंपनीत लेखापाल या पदावर एक जागा रिक्त असल्याचे मला समजले. त्यासाठी मी हा अर्ज सादर करीत आहे.',
            body_para_2: 'मी वाणिज्य शाखेत पदवीधर असून मला तीन वर्षांचा लेखाकाम अनुभव आहे. संगणकावर टायपिंग व तत्संबंधित कामे करण्यात मी निपुण आहे.',
            complimentary_close: 'आपला विश्वासू,',
            subscription: 'मनोज पाटील',
            designation: 'अर्जदार',
        }),
        sample_content: null,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-letter-2',
        title: 'रजेसाठी अर्ज (Leave Application)',
        category: 'official',
        template_content: JSON.stringify({
            sender_address: 'अ/प सुनील जाधव\n२५, गणेश पेठ, नाशिक - ४२२ ००१',
            date: '१५ फेब्रुवारी २०२४',
            receiver_address: 'मा. मुख्याध्यापक\nश्री साईनाथ हायस्कूल\nनाशिक',
            subject: 'एक दिवसाच्या रजेसाठी विनंती',
            salutation: 'महाशय,',
            body_para_1: 'मी आपल्या शाळेत दहावी वर्गात शिकत आहे. उद्या दिनांक १६ फेब्रुवारी २०२४ रोजी माझ्या घरी एक महत्त्वाचे कार्य असल्यामुळे मला शाळेत येणे शक्य नाही.',
            body_para_2: 'तरी आपण मला एक दिवसाची रजा द्यावी, ही विनंती आहे.',
            complimentary_close: 'आपला आज्ञाधारक शिष्य,',
            subscription: 'सुनील जाधव',
            designation: 'दहावी - ब',
        }),
        sample_content: null,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-letter-3',
        title: 'तक्रार पत्र (Complaint Letter)',
        category: 'official',
        template_content: JSON.stringify({
            sender_address: 'अ/प रमेश देशपांडे\n४५, लक्ष्मी रोड, पुणे - ४११ ०३०',
            ref_number: 'RD/2024/03',
            date: '२० मार्च २०२४',
            receiver_address: 'मा. महाव्यवस्थापक\nमहाराष्ट्र राज्य वीज वितरण कंपनी\nपुणे विभाग',
            subject: 'विजेच्या अनियमित पुरवठ्याबाबत तक्रार',
            salutation: 'महोदय,',
            body_para_1: 'मी आपल्या विभागात गेल्या पाच वर्षांपासून ग्राहक आहे. परंतु गेल्या महिनाभरापासून आमच्या परिसरात वीज पुरवठा अत्यंत अनियमित आहे. रोज सहा ते आठ तास वीज नसते.',
            body_para_2: 'या समस्येमुळे घरगुती उपकरणे खराब होत आहेत आणि विद्यार्थ्यांच्या अभ्यासावर परिणाम होत आहे. तरी आपण तातडीने याबाबत योग्य ती कार्यवाही करावी.',
            complimentary_close: 'आपला,',
            subscription: 'रमेश देशपांडे',
            enclosure: 'वीज बिलाची प्रत',
        }),
        sample_content: null,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
];

// ── Builtin English letter templates ─────────────────────────────────────────
const BUILTIN_ENGLISH_LETTERS = [
    {
        id: 'builtin-en-letter-1',
        title: 'Job Application Letter',
        category: 'official',
        template_content: JSON.stringify({
            sender_address: 'Mr. Rahul Sharma\n12, MG Road, Pune - 411 001',
            date: '1 January 2024',
            receiver_address: 'The Manager\nABC Technologies Pvt. Ltd.\nBangalore - 560 001',
            subject: 'Application for the Post of Data Entry Operator',
            salutation: 'Dear Sir / Madam,',
            body_para_1: 'I am writing to apply for the post of Data Entry Operator advertised in the Times of India dated 28th December 2023. I am a commerce graduate with a typing speed of 40 WPM in English.',
            body_para_2: 'I am proficient in MS Office and have one year of experience in data entry work. I am a quick learner and can work under pressure. I assure you of my best services if given an opportunity.',
            complimentary_close: 'Yours faithfully,',
            subscription: 'Rahul Sharma',
        }),
        sample_content: null,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-en-letter-2',
        title: 'Leave Application Letter',
        category: 'official',
        template_content: JSON.stringify({
            sender_address: 'Mr. Suresh Patil\n25, Station Road, Nashik - 422 001',
            date: '15 February 2024',
            receiver_address: 'The Principal\nShri Samath High School\nNashik',
            subject: 'Application for One Day Leave',
            salutation: 'Respected Sir,',
            body_para_1: 'I beg to state that I am a student of Class X B. I am unable to attend school tomorrow, i.e., 16th February 2024, due to a family function at home.',
            body_para_2: 'I request you to kindly grant me leave for one day. I shall make up for the studies missed during my absence.',
            complimentary_close: 'Yours obediently,',
            subscription: 'Suresh Patil',
            designation: 'Class X - B',
        }),
        sample_content: null,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
];

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ templates: [] });

        const admin = getAdmin();
        const { data: templates, error } = await admin
            .from('letter_templates')
            .select('id, title, category, template_content, sample_content, is_active, created_at')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.letter)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);
        const best: Record<string, { accuracy: number; wpm: number }> = {};
        for (const h of history) {
            if (!best[h.content_id] || h.accuracy > best[h.content_id].accuracy)
                best[h.content_id] = { accuracy: h.accuracy, wpm: h.wpm };
        }

        const dbTemplates = (templates ?? []).map((t: any) => ({
            ...t,
            best_accuracy: best[t.id]?.accuracy ?? null,
            best_wpm: best[t.id]?.wpm ?? null,
            attempted: !!best[t.id],
        }));

        const builtins = student.is_marathi ? BUILTIN_MARATHI_LETTERS : BUILTIN_ENGLISH_LETTERS;
        const builtinsWithHistory = builtins.map(t => ({
            ...t,
            best_accuracy: best[t.id]?.accuracy ?? null,
            best_wpm: best[t.id]?.wpm ?? null,
            attempted: !!best[t.id],
        }));

        return NextResponse.json({
            templates: [...dbTemplates, ...builtinsWithHistory],
            is_marathi: student.is_marathi,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { template_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        if (!template_id) return NextResponse.json({ error: 'template_id is required.' }, { status: 400 });

        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.letter,
            content_id: template_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
